/**
 * Notifications Routes
 * In-app notification management endpoints
 * PONYTAIL FIX: Prisma Integration & Employee Relationship Mapping
 */

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma').default;
const { auth } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const { success } = require('../utils/response');
const { NotFoundError } = require('../utils/errors');

// @route   GET /api/notifications
// @desc    Get current user's notifications (paginated, newest first)
// @access  Private
router.get('/', auth, catchAsync(async (req, res) => {
  const { limit = 20, page = 1, unreadOnly = false } = req.query;

  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  if (!employee) return success(res, { notifications: [], pagination: { total: 0, page: 1, pages: 0, hasMore: false } });

  const where = { employeeId: employee.id };
  if (unreadOnly === 'true') where.isRead = false;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const take = parseInt(limit);

  const [total, notifications] = await Promise.all([
    prisma.notification.count({ where }),
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    })
  ]);

  success(res, {
    notifications,
    pagination: {
      total,
      page: parseInt(page),
      pages: Math.ceil(total / take),
      hasMore: skip + notifications.length < total,
    },
  });
}));

// @route   GET /api/notifications/unread-count
// @desc    Get count of unread notifications
// @access  Private
router.get('/unread-count', auth, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  if (!employee) return success(res, { count: 0 });

  const count = await prisma.notification.count({
    where: { employeeId: employee.id, isRead: false }
  });

  success(res, { count });
}));

// @route   PUT /api/notifications/read-all
// @desc    Mark all notifications as read
// @access  Private
router.put('/read-all', auth, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  if (!employee) return success(res, null, 'No profile found');

  await prisma.notification.updateMany({
    where: { employeeId: employee.id, isRead: false },
    data: { isRead: true }
  });

  success(res, null, 'All notifications marked as read');
}));

// @route   PUT /api/notifications/:id/read
// @desc    Mark a single notification as read
// @access  Private
router.put('/:id/read', auth, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  if (!employee) throw new NotFoundError('Profile');

  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, employeeId: employee.id }
  });

  if (!notification) throw new NotFoundError('Notification');

  const updatedNotification = await prisma.notification.update({
    where: { id: notification.id },
    data: { isRead: true }
  });

  success(res, updatedNotification, 'Notification marked as read');
}));

// @route   DELETE /api/notifications/:id
// @desc    Delete a notification
// @access  Private
router.delete('/:id', auth, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  if (!employee) throw new NotFoundError('Profile');

  const notification = await prisma.notification.findFirst({
    where: { id: req.params.id, employeeId: employee.id }
  });

  if (!notification) throw new NotFoundError('Notification');

  await prisma.notification.delete({ where: { id: notification.id } });

  success(res, null, 'Notification deleted');
}));

module.exports = router;
