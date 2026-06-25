/**
 * Notification Helper Utility
 * Creates notifications without duplicating code across routes
 * PONYTAIL FIX: Prisma Integration & Employee Mapping
 */

const prisma = require('../lib/prisma').default;

/**
 * Create a single notification
 * @param {Object} data - Notification data
 * @param {string} data.recipient - User ID of the recipient
 * @param {string} data.type - Notification type enum
 * @param {string} data.title - Short headline
 * @param {string} data.message - Description text
 * @param {string} [data.link] - Optional navigation path
 * @param {string} [data.relatedId] - Optional reference to source document
 * @returns {Promise<Object>} Created notification
 */
const createNotification = async ({ recipient, type, title, message, link = null, relatedId = null }) => {
  try {
    const employee = await prisma.employee.findUnique({ where: { userId: recipient } });
    if (!employee) return null;

    const notification = await prisma.notification.create({
      data: {
        employeeId: employee.id,
        type: type || 'system',
        title,
        message,
        link: link || null,
        isRead: false,
      }
    });
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error.message);
    return null;
  }
};

/**
 * Create notifications for multiple recipients
 * @param {Array<string>} recipients - Array of User IDs
 * @param {Object} data - Notification data
 * @returns {Promise<Array>} Created notifications
 */
const createBulkNotifications = async (recipients, { type, title, message, link = null, relatedId = null }) => {
  try {
    const employees = await prisma.employee.findMany({
      where: { userId: { in: recipients } },
      select: { id: true }
    });

    if (employees.length === 0) return [];

    const notifications = employees.map(emp => ({
      employeeId: emp.id,
      type: type || 'system',
      title,
      message,
      link: link || null,
      isRead: false,
    }));

    // In Prisma, createMany is used for bulk inserts
    const result = await prisma.notification.createMany({
      data: notifications,
      skipDuplicates: true
    });
    return result;
  } catch (error) {
    console.error('Failed to create bulk notifications:', error.message);
    return [];
  }
};

module.exports = {
  createNotification,
  createBulkNotifications,
};
