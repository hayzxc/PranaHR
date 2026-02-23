/**
 * Task Model
 * Daily tasks assigned to employees
 */

const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Task title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
        type: String,
        maxlength: [2000, 'Description cannot exceed 2000 characters'],
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: [true, 'Task must be assigned to an employee'],
    },
    assignedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: {
            values: ['pending', 'in_progress', 'completed', 'cancelled'],
            message: '{VALUE} is not a valid status',
        },
        default: 'pending',
    },
    priority: {
        type: String,
        enum: {
            values: ['low', 'medium', 'high'],
            message: '{VALUE} is not a valid priority',
        },
        default: 'medium',
    },
    dueDate: {
        type: Date,
        required: [true, 'Due date is required'],
    },
    category: {
        type: String,
        trim: true,
        maxlength: [50, 'Category cannot exceed 50 characters'],
    },
    completedAt: {
        type: Date,
        default: null,
    },
    notes: {
        type: String,
        maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    },
}, {
    timestamps: true,
    toJSON: {
        transform: function (doc, ret) {
            delete ret.__v;
            return ret;
        },
    },
});

// Indexes
taskSchema.index({ assignedTo: 1, status: 1 });
taskSchema.index({ assignedTo: 1, dueDate: 1 });
taskSchema.index({ dueDate: 1 });
taskSchema.index({ status: 1 });

// Virtual for checking if task is overdue
taskSchema.virtual('isOverdue').get(function () {
    if (this.status === 'completed' || this.status === 'cancelled') return false;
    return this.dueDate < new Date();
});

// Set completedAt when status changes to completed
taskSchema.pre('save', function (next) {
    if (this.isModified('status') && this.status === 'completed' && !this.completedAt) {
        this.completedAt = new Date();
    }
    next();
});

module.exports = mongoose.model('Task', taskSchema);
