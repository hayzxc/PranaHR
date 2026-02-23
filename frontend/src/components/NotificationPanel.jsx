import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../context/NotificationContext';
import {
    Bell,
    Check,
    CheckCheck,
    Trash2,
    Calendar,
    ClipboardList,
    Megaphone,
    UserPlus,
    DollarSign,
    Target,
    Info,
    X,
    Loader2,
} from 'lucide-react';

const NOTIFICATION_ICONS = {
    leave_approved: { icon: Calendar, color: '#10b981', bg: '#ecfdf5' },
    leave_rejected: { icon: Calendar, color: '#ef4444', bg: '#fef2f2' },
    leave_requested: { icon: Calendar, color: '#f59e0b', bg: '#fffbeb' },
    task_assigned: { icon: ClipboardList, color: '#6366f1', bg: '#eef2ff' },
    task_completed: { icon: Check, color: '#10b981', bg: '#ecfdf5' },
    announcement: { icon: Megaphone, color: '#8b5cf6', bg: '#f5f3ff' },
    onboarding: { icon: UserPlus, color: '#06b6d4', bg: '#ecfeff' },
    payroll: { icon: DollarSign, color: '#f59e0b', bg: '#fffbeb' },
    performance: { icon: Target, color: '#ec4899', bg: '#fdf2f8' },
    general: { icon: Info, color: '#6b7280', bg: '#f9fafb' },
};

function timeAgo(date) {
    const now = new Date();
    const diff = now - new Date(date);
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

const NotificationPanel = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const panelRef = useRef(null);
    const {
        notifications,
        unreadCount,
        loading,
        fetchNotifications,
        markAsRead,
        markAllAsRead,
        deleteNotification,
    } = useNotifications();
    const [deletingId, setDeletingId] = useState(null);

    // Fetch notifications when panel opens
    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen, fetchNotifications]);

    // Close panel on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (panelRef.current && !panelRef.current.contains(e.target)) {
                onClose();
            }
        };

        if (isOpen) {
            // Delay to prevent immediate close from the same click
            setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 0);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen, onClose]);

    const handleNotificationClick = async (notification) => {
        if (!notification.isRead) {
            await markAsRead(notification._id);
        }
        if (notification.link) {
            navigate(notification.link);
            onClose();
        }
    };

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        setDeletingId(id);
        await deleteNotification(id);
        setDeletingId(null);
    };

    if (!isOpen) return null;

    return (
        <div
            ref={panelRef}
            className="notification-panel"
            style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 8px)',
                width: '400px',
                maxHeight: '520px',
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                animation: 'notifSlideIn 0.25s ease-out',
            }}
        >
            {/* Header */}
            <div
                style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid #f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexShrink: 0,
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 700,
                        color: '#1e293b',
                    }}>
                        Notifications
                    </h3>
                    {unreadCount > 0 && (
                        <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '22px',
                            height: '22px',
                            padding: '0 6px',
                            borderRadius: '11px',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            fontSize: '11px',
                            fontWeight: 700,
                        }}>
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {unreadCount > 0 && (
                        <button
                            onClick={markAllAsRead}
                            title="Mark all as read"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '6px 10px',
                                border: 'none',
                                background: '#f1f5f9',
                                borderRadius: '8px',
                                color: '#6366f1',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: 600,
                                transition: 'all 0.15s ease',
                            }}
                            onMouseOver={(e) => {
                                e.currentTarget.style.background = '#e0e7ff';
                            }}
                            onMouseOut={(e) => {
                                e.currentTarget.style.background = '#f1f5f9';
                            }}
                        >
                            <CheckCheck style={{ width: 14, height: 14 }} />
                            Read all
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '32px',
                            height: '32px',
                            border: 'none',
                            background: 'transparent',
                            borderRadius: '8px',
                            color: '#94a3b8',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                        }}
                        onMouseOver={(e) => {
                            e.currentTarget.style.background = '#f1f5f9';
                            e.currentTarget.style.color = '#64748b';
                        }}
                        onMouseOut={(e) => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = '#94a3b8';
                        }}
                    >
                        <X style={{ width: 16, height: 16 }} />
                    </button>
                </div>
            </div>

            {/* Notification List */}
            <div
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                }}
            >
                {loading && notifications.length === 0 ? (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '48px 20px',
                        color: '#94a3b8',
                    }}>
                        <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite' }} />
                    </div>
                ) : notifications.length === 0 ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '48px 20px',
                        color: '#94a3b8',
                    }}>
                        <Bell style={{ width: 40, height: 40, marginBottom: '12px', opacity: 0.4 }} />
                        <p style={{ margin: 0, fontSize: '14px', fontWeight: 500 }}>
                            No notifications yet
                        </p>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', opacity: 0.7 }}>
                            You'll see updates here
                        </p>
                    </div>
                ) : (
                    notifications.map((notif, index) => {
                        const iconConfig = NOTIFICATION_ICONS[notif.type] || NOTIFICATION_ICONS.general;
                        const IconComponent = iconConfig.icon;

                        return (
                            <div
                                key={notif._id}
                                onClick={() => handleNotificationClick(notif)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '12px',
                                    padding: '14px 20px',
                                    cursor: notif.link ? 'pointer' : 'default',
                                    backgroundColor: notif.isRead ? 'transparent' : '#fafbff',
                                    borderLeft: notif.isRead ? '3px solid transparent' : '3px solid #6366f1',
                                    borderBottom: index < notifications.length - 1 ? '1px solid #f8fafc' : 'none',
                                    transition: 'all 0.15s ease',
                                    position: 'relative',
                                    animation: `notifItemIn 0.2s ease-out ${index * 30}ms both`,
                                }}
                                onMouseOver={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f8fafc';
                                }}
                                onMouseOut={(e) => {
                                    e.currentTarget.style.backgroundColor = notif.isRead ? 'transparent' : '#fafbff';
                                }}
                            >
                                {/* Icon */}
                                <div style={{
                                    flexShrink: 0,
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '10px',
                                    backgroundColor: iconConfig.bg,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <IconComponent
                                        style={{
                                            width: 18,
                                            height: 18,
                                            color: iconConfig.color,
                                        }}
                                    />
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{
                                        margin: 0,
                                        fontSize: '13px',
                                        fontWeight: notif.isRead ? 500 : 600,
                                        color: '#1e293b',
                                        lineHeight: 1.4,
                                    }}>
                                        {notif.title}
                                    </p>
                                    <p style={{
                                        margin: '2px 0 0',
                                        fontSize: '12px',
                                        color: '#64748b',
                                        lineHeight: 1.4,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                    }}>
                                        {notif.message}
                                    </p>
                                    <span style={{
                                        display: 'inline-block',
                                        marginTop: '4px',
                                        fontSize: '11px',
                                        color: '#94a3b8',
                                        fontWeight: 500,
                                    }}>
                                        {timeAgo(notif.createdAt)}
                                    </span>
                                </div>

                                {/* Actions */}
                                <div style={{
                                    flexShrink: 0,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    opacity: 0,
                                    transition: 'opacity 0.15s ease',
                                }}
                                    className="notif-actions"
                                >
                                    <button
                                        onClick={(e) => handleDelete(e, notif._id)}
                                        disabled={deletingId === notif._id}
                                        title="Delete"
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            width: '28px',
                                            height: '28px',
                                            border: 'none',
                                            background: 'transparent',
                                            borderRadius: '6px',
                                            color: '#94a3b8',
                                            cursor: 'pointer',
                                            transition: 'all 0.15s ease',
                                        }}
                                        onMouseOver={(e) => {
                                            e.currentTarget.style.background = '#fef2f2';
                                            e.currentTarget.style.color = '#ef4444';
                                        }}
                                        onMouseOut={(e) => {
                                            e.currentTarget.style.background = 'transparent';
                                            e.currentTarget.style.color = '#94a3b8';
                                        }}
                                    >
                                        <Trash2 style={{ width: 14, height: 14 }} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Inline hover styles */}
            <style>{`
                @keyframes notifSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-8px) scale(0.98);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }
                @keyframes notifItemIn {
                    from {
                        opacity: 0;
                        transform: translateX(-6px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .notification-panel div:hover > .notif-actions {
                    opacity: 1 !important;
                }
            `}</style>
        </div>
    );
};

export default NotificationPanel;
