const mongoose = require('mongoose');

const keyResultSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Key result title is required'],
        trim: true,
    },
    description: {
        type: String,
        default: '',
    },
    targetValue: {
        type: Number,
        required: [true, 'Target value is required'],
        min: 0,
    },
    currentValue: {
        type: Number,
        default: 0,
        min: 0,
    },
    unit: {
        type: String,
        default: '%',
        trim: true,
    },
    weight: {
        type: Number,
        default: 1,
        min: 0.1,
        max: 10,
    },
    status: {
        type: String,
        enum: ['not-started', 'in-progress', 'at-risk', 'completed'],
        default: 'not-started',
    },
}, { _id: true });

const okrSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Objective title is required'],
        trim: true,
        maxlength: 200,
    },
    description: {
        type: String,
        default: '',
        maxlength: 1000,
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
    },
    cycle: {
        type: String,
        required: [true, 'OKR cycle is required'],
        enum: ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Annual'],
    },
    year: {
        type: Number,
        required: [true, 'Year is required'],
    },
    category: {
        type: String,
        enum: ['individual', 'team', 'department', 'company'],
        default: 'individual',
    },
    keyResults: {
        type: [keyResultSchema],
        validate: {
            validator: function (v) {
                return v.length >= 1 && v.length <= 10;
            },
            message: 'An OKR must have between 1 and 10 key results',
        },
    },
    parentObjective: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OKR',
        default: null,
    },
    score: {
        type: Number,
        default: 0,
        min: 0,
        max: 1,
    },
    status: {
        type: String,
        enum: ['draft', 'active', 'completed', 'cancelled'],
        default: 'draft',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
    },
}, {
    timestamps: true,
});

// Calculate weighted score from key results before saving
okrSchema.pre('save', function (next) {
    if (this.keyResults && this.keyResults.length > 0) {
        const totalWeight = this.keyResults.reduce((sum, kr) => sum + kr.weight, 0);

        if (totalWeight > 0) {
            const weightedScore = this.keyResults.reduce((sum, kr) => {
                const progress = kr.targetValue > 0
                    ? Math.min(kr.currentValue / kr.targetValue, 1)
                    : 0;
                return sum + (progress * kr.weight);
            }, 0);

            this.score = Math.round((weightedScore / totalWeight) * 100) / 100;
        }

        // Auto-update key result statuses
        this.keyResults.forEach(kr => {
            if (kr.targetValue > 0) {
                const progress = kr.currentValue / kr.targetValue;
                if (progress >= 1) {
                    kr.status = 'completed';
                } else if (progress > 0) {
                    kr.status = 'in-progress';
                }
            }
        });

        // Auto-complete objective if score >= 0.7
        if (this.score >= 0.7 && this.status === 'active') {
            // Don't auto-complete, just leave it. Admin decides.
        }
    }

    next();
});

// Indexes for common query patterns
okrSchema.index({ owner: 1, status: 1 });
okrSchema.index({ cycle: 1, year: 1 });
okrSchema.index({ 'category': 1 });
okrSchema.index({ parentObjective: 1 });

module.exports = mongoose.model('OKR', okrSchema);
