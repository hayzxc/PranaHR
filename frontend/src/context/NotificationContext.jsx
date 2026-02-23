import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { notificationAPI } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const { isAuthenticated } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState(null);

    // Fetch unread count
    const fetchUnreadCount = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const res = await notificationAPI.getUnreadCount();
            setUnreadCount(res.data.data.count);
        } catch (err) {
            // Silently fail — don't break the app
            console.error('Failed to fetch unread count:', err.message);
        }
    }, [isAuthenticated]);

    // Fetch notifications list
    const fetchNotifications = useCallback(async (page = 1) => {
        if (!isAuthenticated) return;
        try {
            setLoading(true);
            const res = await notificationAPI.getAll({ page, limit: 20 });
            const data = res.data.data;
            setNotifications(data.notifications);
            setPagination(data.pagination);
        } catch (err) {
            console.error('Failed to fetch notifications:', err.message);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated]);

    // Mark single notification as read
    const markAsRead = useCallback(async (id) => {
        try {
            await notificationAPI.markAsRead(id);
            setNotifications(prev =>
                prev.map(n => n._id === id ? { ...n, isRead: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark notification as read:', err.message);
        }
    }, []);

    // Mark all as read
    const markAllAsRead = useCallback(async () => {
        try {
            await notificationAPI.markAllAsRead();
            setNotifications(prev =>
                prev.map(n => ({ ...n, isRead: true }))
            );
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all as read:', err.message);
        }
    }, []);

    // Delete a notification
    const deleteNotification = useCallback(async (id) => {
        try {
            const notif = notifications.find(n => n._id === id);
            await notificationAPI.delete(id);
            setNotifications(prev => prev.filter(n => n._id !== id));
            if (notif && !notif.isRead) {
                setUnreadCount(prev => Math.max(0, prev - 1));
            }
        } catch (err) {
            console.error('Failed to delete notification:', err.message);
        }
    }, [notifications]);

    // Poll unread count every 30 seconds
    useEffect(() => {
        if (!isAuthenticated) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        fetchUnreadCount();

        const interval = setInterval(fetchUnreadCount, 30000);
        return () => clearInterval(interval);
    }, [isAuthenticated, fetchUnreadCount]);

    const value = {
        notifications,
        unreadCount,
        loading,
        pagination,
        fetchNotifications,
        fetchUnreadCount,
        markAsRead,
        markAllAsRead,
        deleteNotification,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export default NotificationContext;
