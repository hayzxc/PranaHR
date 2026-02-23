/**
 * Notification Model
 * In-app notifications for user actions like leave approvals, task assignments, etc.
 */

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Recipient is required'],
    },
    type: {
        type: String,
        required: [true, 'Notification type is required'],
        enum: [
            'leave_approved',
            'leave_rejected',
            'leave_requested',
            'task_assigned',
            'task_completed',
            'announcement',
            'onboarding',
            'payroll',
            'performance',
            'general',
        ],
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: 200,
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxlength: 500,
    },
    link: {
        type: String,
        trim: true,
        default: null,
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
}, {
    timestamps: true,
});

// Indexes for fast queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

// Auto-delete notifications older than 30 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('Notification', notificationSchema);
