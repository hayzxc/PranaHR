/**
 * Notification Helper Utility
 * Creates notifications without duplicating code across routes
 */

const Notification = require('../models/Notification');

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
        const notification = await Notification.create({
            recipient,
            type,
            title,
            message,
            link,
            relatedId,
        });
        return notification;
    } catch (error) {
        // Log but don't throw - notifications should not break main operations
        console.error('Failed to create notification:', error.message);
        return null;
    }
};

/**
 * Create notifications for multiple recipients
 * @param {Array<string>} recipients - Array of User IDs
 * @param {Object} data - Notification data (type, title, message, link, relatedId)
 * @returns {Promise<Array>} Created notifications
 */
const createBulkNotifications = async (recipients, { type, title, message, link = null, relatedId = null }) => {
    try {
        const notifications = recipients.map(recipient => ({
            recipient,
            type,
            title,
            message,
            link,
            relatedId,
        }));
        const result = await Notification.insertMany(notifications, { ordered: false });
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
