const mongoose = require('mongoose');

const kpiEntrySchema = new mongoose.Schema({
    value: {
        type: Number,
        required: [true, 'Value is required'],
    },
    date: {
        type: Date,
        required: [true, 'Date is required'],
    },
    notes: {
        type: String,
        default: '',
        maxlength: 500,
    },
}, { _id: true, timestamps: false });

const kpiSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'KPI name is required'],
        trim: true,
        maxlength: 200,
    },
    description: {
        type: String,
        default: '',
        maxlength: 1000,
    },
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
    },
    department: {
        type: String,
        enum: ['Sertifikasi', 'Finance', 'Admin/CS', 'Verifikasi', 'Teknis dan IT'],
    },
    category: {
        type: String,
        enum: ['productivity', 'quality', 'efficiency', 'engagement', 'financial', 'customer', 'custom'],
        default: 'productivity',
    },
    unit: {
        type: String,
        required: [true, 'Unit is required'],
        trim: true,
        maxlength: 50,
    },
    targetValue: {
        type: Number,
        required: [true, 'Target value is required'],
    },
    currentValue: {
        type: Number,
        default: 0,
    },
    frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'quarterly', 'annually'],
        default: 'monthly',
    },
    entries: [kpiEntrySchema],
    trend: {
        type: String,
        enum: ['improving', 'declining', 'stable', 'insufficient-data'],
        default: 'insufficient-data',
    },
    status: {
        type: String,
        enum: ['active', 'paused', 'archived'],
        default: 'active',
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
    },
}, {
    timestamps: true,
});

// Update currentValue and trend when entries change
kpiSchema.pre('save', function (next) {
    if (this.entries && this.entries.length > 0) {
        // Sort entries by date descending
        const sorted = [...this.entries].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Set current value to the most recent entry
        this.currentValue = sorted[0].value;

        // Calculate trend from last 3+ entries
        if (sorted.length >= 3) {
            const recent = sorted.slice(0, 3).map(e => e.value);
            const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;

            const older = sorted.slice(Math.max(0, sorted.length - 3)).map(e => e.value);
            const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;

            const changePercent = avgOlder !== 0
                ? ((avgRecent - avgOlder) / Math.abs(avgOlder)) * 100
                : 0;

            if (changePercent > 5) {
                this.trend = 'improving';
            } else if (changePercent < -5) {
                this.trend = 'declining';
            } else {
                this.trend = 'stable';
            }
        } else {
            this.trend = 'insufficient-data';
        }
    }

    next();
});

// Indexes
kpiSchema.index({ employee: 1, status: 1 });
kpiSchema.index({ department: 1 });
kpiSchema.index({ category: 1 });

module.exports = mongoose.model('KPI', kpiSchema);
