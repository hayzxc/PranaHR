/**
 * Announcement Model
 * Company-wide announcements and news
 */

const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
    title: {
        type: String,
        required: [true, 'Announcement title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    content: {
        type: String,
        required: [true, 'Announcement content is required'],
        maxlength: [5000, 'Content cannot exceed 5000 characters'],
    },
    type: {
        type: String,
        enum: {
            values: ['info', 'warning', 'urgent', 'celebration'],
            message: '{VALUE} is not a valid announcement type',
        },
        default: 'info',
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    authorName: {
        type: String,
        required: true,
    },
    isPinned: {
        type: Boolean,
        default: false,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    expiresAt: {
        type: Date,
        default: null,
    },
    viewCount: {
        type: Number,
        default: 0,
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

// Indexes for efficient queries
announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ isPinned: -1, createdAt: -1 });
announcementSchema.index({ isActive: 1, expiresAt: 1 });
announcementSchema.index({ type: 1 });

/**
 * Static method to get active announcements
 * @param {number} limit - Maximum number of announcements
 * @returns {Promise<Announcement[]>} Active announcements
 */
announcementSchema.statics.getActive = async function (limit = 10) {
    const now = new Date();
    return this.find({
        isActive: true,
        $or: [
            { expiresAt: null },
            { expiresAt: { $gt: now } },
        ],
    })
        .sort({ isPinned: -1, createdAt: -1 })
        .limit(limit)
        .populate('author', 'email');
};

module.exports = mongoose.model('Announcement', announcementSchema);
