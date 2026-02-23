/**
 * Notifications Routes
 * In-app notification management endpoints
 */

const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { auth } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const { success } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');

// @route   GET /api/notifications
// @desc    Get current user's notifications (paginated, newest first)
// @access  Private
router.get('/', auth, catchAsync(async (req, res) => {
    const { limit = 20, page = 1, unreadOnly = false } = req.query;

    const query = { recipient: req.user._id };

    if (unreadOnly === 'true') {
        query.isRead = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [notifications, total] = await Promise.all([
        Notification.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        Notification.countDocuments(query),
    ]);

    success(res, {
        notifications,
        pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            hasMore: skip + notifications.length < total,
        },
    });
}));

// @route   GET /api/notifications/unread-count
// @desc    Get count of unread notifications
// @access  Private
router.get('/unread-count', auth, catchAsync(async (req, res) => {
    const count = await Notification.countDocuments({
        recipient: req.user._id,
        isRead: false,
    });

    success(res, { count });
}));

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', auth, catchAsync(async (req, res) => {
    await Notification.updateMany(
        { recipient: req.user._id, isRead: false },
        { isRead: true }
    );

    success(res, null, 'All notifications marked as read');
}));

// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
router.put('/:id/read', auth, catchAsync(async (req, res) => {
    const notification = await Notification.findOne({
        _id: req.params.id,
        recipient: req.user._id,
    });

    if (!notification) {
        throw new NotFoundError('Notification');
    }

    notification.isRead = true;
    await notification.save();

    success(res, notification, 'Notification marked as read');
}));

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete('/:id', auth, catchAsync(async (req, res) => {
    const notification = await Notification.findOne({
        _id: req.params.id,
        recipient: req.user._id,
    });

    if (!notification) {
        throw new NotFoundError('Notification');
    }

    await notification.deleteOne();

    success(res, null, 'Notification deleted');
}));

module.exports = router;
