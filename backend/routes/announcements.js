/**
 * Announcements Routes
 * Company-wide announcements and news management
 */

const express = require('express');
const router = express.Router();
const Announcement = require('../models/Announcement');
const Employee = require('../models/Employee');
const { auth, authorize } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created } = require('../utils/response');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const User = require('../models/User');
const { createBulkNotifications } = require('../utils/notifications');

// @route   GET /api/announcements
// @desc    Get all active announcements
// @access  Private
router.get('/', auth, catchAsync(async (req, res) => {
    const { limit = 10, page = 1, type, includeExpired = false } = req.query;

    const query = { isActive: true };

    // Filter by type if specified
    if (type && ['info', 'warning', 'urgent', 'celebration'].includes(type)) {
        query.type = type;
    }

    // Exclude expired announcements unless requested
    if (!includeExpired || includeExpired === 'false') {
        query.$or = [
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } },
        ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [announcements, total] = await Promise.all([
        Announcement.find(query)
            .sort({ isPinned: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('author', 'email'),
        Announcement.countDocuments(query),
    ]);

    success(res, {
        announcements,
        pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            hasMore: skip + announcements.length < total,
        },
    });
}));

// @route   GET /api/announcements/latest
// @desc    Get latest announcements for dashboard
// @access  Private
router.get('/latest', auth, catchAsync(async (req, res) => {
    const limit = parseInt(req.query.limit) || 5;
    const announcements = await Announcement.getActive(limit);
    success(res, announcements);
}));

// @route   GET /api/announcements/:id
// @desc    Get single announcement
// @access  Private
router.get('/:id', auth, catchAsync(async (req, res) => {
    const announcement = await Announcement.findById(req.params.id)
        .populate('author', 'email');

    if (!announcement) {
        throw new NotFoundError('Announcement');
    }

    // Increment view count
    announcement.viewCount += 1;
    await announcement.save();

    success(res, announcement);
}));

// @route   POST /api/announcements
// @desc    Create new announcement
// @access  Private (Admin/HR)
router.post('/', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
    const { title, content, type, isPinned, expiresAt } = req.body;

    if (!title || !content) {
        throw new BadRequestError('Title and content are required');
    }

    // Get author name from employee record
    const employee = await Employee.findOne({ user: req.user._id });
    const authorName = employee?.name || req.user.email;

    const announcement = await Announcement.create({
        title,
        content,
        type: type || 'info',
        isPinned: isPinned || false,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        author: req.user._id,
        authorName,
    });

    await announcement.populate('author', 'email');

    // Notify all active users about the new announcement
    const allUsers = await User.find({ isActive: true, _id: { $ne: req.user._id } }).select('_id');
    if (allUsers.length > 0) {
        const typeLabel = type === 'urgent' ? '🚨 Urgent' : type === 'warning' ? '⚠️ Important' : type === 'celebration' ? '🎉' : '📢';
        createBulkNotifications(
            allUsers.map(u => u._id),
            {
                type: 'announcement',
                title: `${typeLabel} Announcement`,
                message: title.length > 100 ? title.substring(0, 100) + '...' : title,
                link: '/announcements',
                relatedId: announcement._id,
            }
        );
    }

    created(res, announcement, 'Announcement created successfully');
}));

// @route   PUT /api/announcements/:id
// @desc    Update announcement
// @access  Private (Admin/HR)
router.put('/:id', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
    const { title, content, type, isPinned, isActive, expiresAt } = req.body;

    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
        throw new NotFoundError('Announcement');
    }

    // Update fields
    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (type) announcement.type = type;
    if (isPinned !== undefined) announcement.isPinned = isPinned;
    if (isActive !== undefined) announcement.isActive = isActive;
    if (expiresAt !== undefined) {
        announcement.expiresAt = expiresAt ? new Date(expiresAt) : null;
    }

    await announcement.save();
    await announcement.populate('author', 'email');

    success(res, announcement, 'Announcement updated successfully');
}));

// @route   DELETE /api/announcements/:id
// @desc    Delete announcement
// @access  Private (Admin/HR)
router.delete('/:id', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
        throw new NotFoundError('Announcement');
    }

    await announcement.deleteOne();

    success(res, null, 'Announcement deleted successfully');
}));

// @route   PUT /api/announcements/:id/pin
// @desc    Toggle pin status
// @access  Private (Admin/HR)
router.put('/:id/pin', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
        throw new NotFoundError('Announcement');
    }

    announcement.isPinned = !announcement.isPinned;
    await announcement.save();

    success(res, announcement, `Announcement ${announcement.isPinned ? 'pinned' : 'unpinned'} successfully`);
}));

module.exports = router;
