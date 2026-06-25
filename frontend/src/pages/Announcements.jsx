import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { announcementAPI } from '../services/api';
import {
    Megaphone,
    Plus,
    Edit2,
    Trash2,
    Pin,
    PinOff,
    X,
    Info,
    AlertTriangle,
    AlertCircle,
    PartyPopper,
    Calendar,
    Eye
} from 'lucide-react';

const Announcements = () => {
    const { canManageEmployees } = useAuth();
    const { showToast } = useToast();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAnnouncement, setEditingAnnouncement] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        type: 'info',
        isPinned: false,
        expiresAt: ''
    });

    const typeOptions = [
        { value: 'info', label: 'Information', icon: Info, color: 'blue' },
        { value: 'warning', label: 'Warning', icon: AlertTriangle, color: 'amber' },
        { value: 'urgent', label: 'Urgent', icon: AlertCircle, color: 'red' },
        { value: 'celebration', label: 'Celebration', icon: PartyPopper, color: 'emerald' },
    ];

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        try {
            const response = await announcementAPI.getAll({ limit: 50, includeExpired: true });
            setAnnouncements(response.data.data.announcements || []);
        } catch (error) {
            console.error('Error fetching announcements:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                expiresAt: formData.expiresAt || null
            };

            if (editingAnnouncement) {
                await announcementAPI.update(editingAnnouncement.id, payload);
            } else {
                await announcementAPI.create(payload);
            }

            setShowModal(false);
            setEditingAnnouncement(null);
            setFormData({ title: '', content: '', type: 'info', isPinned: false, expiresAt: '' });
            fetchAnnouncements();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save announcement', 'error');
        }
    };

    const handleEdit = (announcement) => {
        setEditingAnnouncement(announcement);
        setFormData({
            title: announcement.title,
            content: announcement.content,
            type: announcement.type,
            isPinned: announcement.isPinned,
            expiresAt: announcement.expiresAt ? new Date(announcement.expiresAt).toISOString().split('T')[0] : ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this announcement?')) return;
        try {
            await announcementAPI.delete(id);
            fetchAnnouncements();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to delete announcement', 'error');
        }
    };

    const handleTogglePin = async (id) => {
        try {
            await announcementAPI.togglePin(id);
            fetchAnnouncements();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to toggle pin', 'error');
        }
    };

    const getTypeStyle = (type) => {
        switch (type) {
            case 'warning': return { bg: 'bg-amber-100', text: 'text-amber-700', icon: AlertTriangle };
            case 'urgent': return { bg: 'bg-red-100', text: 'text-red-700', icon: AlertCircle };
            case 'celebration': return { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: PartyPopper };
            default: return { bg: 'bg-blue-100', text: 'text-blue-700', icon: Info };
        }
    };

    if (!canManageEmployees) {
        return (
            <div className="text-center py-12">
                <p className="text-surface-500">You don't have permission to manage announcements.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-800 flex items-center gap-3">
                        <Megaphone className="w-7 h-7 text-primary-600" />
                        Announcements
                    </h1>
                    <p className="text-surface-500 mt-1">Create and manage company announcements</p>
                </div>
                <button
                    onClick={() => {
                        setEditingAnnouncement(null);
                        setFormData({ title: '', content: '', type: 'info', isPinned: false, expiresAt: '' });
                        setShowModal(true);
                    }}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    New Announcement
                </button>
            </div>

            {/* Announcements List */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card animate-pulse">
                            <div className="h-6 bg-surface-200 rounded w-1/3 mb-3"></div>
                            <div className="h-4 bg-surface-200 rounded w-2/3"></div>
                        </div>
                    ))}
                </div>
            ) : announcements.length === 0 ? (
                <div className="card text-center py-12">
                    <Megaphone className="w-12 h-12 text-surface-300 mx-auto mb-4" />
                    <p className="text-surface-500">No announcements yet</p>
                    <p className="text-sm text-surface-400">Create your first announcement to get started</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {announcements.map((announcement) => {
                        const typeStyle = getTypeStyle(announcement.type);
                        const TypeIcon = typeStyle.icon;
                        const isExpired = announcement.expiresAt && new Date(announcement.expiresAt) < new Date();

                        return (
                            <div
                                key={announcement.id}
                                className={`card hover:shadow-lg transition-shadow ${isExpired ? 'opacity-60' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex items-start gap-4 flex-1">
                                        <div className={`p-3 rounded-xl ${typeStyle.bg}`}>
                                            <TypeIcon className={`w-6 h-6 ${typeStyle.text}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                {announcement.isPinned && (
                                                    <Pin className="w-4 h-4 text-primary-600" />
                                                )}
                                                <h3 className="font-semibold text-surface-800 truncate">
                                                    {announcement.title}
                                                </h3>
                                                <span className={`badge ${typeStyle.bg} ${typeStyle.text} capitalize`}>
                                                    {announcement.type}
                                                </span>
                                                {isExpired && (
                                                    <span className="badge bg-surface-200 text-surface-600">Expired</span>
                                                )}
                                            </div>
                                            <p className="text-surface-600 line-clamp-2 mb-2">
                                                {announcement.content}
                                            </p>
                                            <div className="flex items-center gap-4 text-xs text-surface-400">
                                                <span>{announcement.authorName}</span>
                                                <span>•</span>
                                                <span>{new Date(announcement.createdAt).toLocaleDateString()}</span>
                                                {announcement.expiresAt && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="flex items-center gap-1">
                                                            <Calendar className="w-3 h-3" />
                                                            Expires: {new Date(announcement.expiresAt).toLocaleDateString()}
                                                        </span>
                                                    </>
                                                )}
                                                <span>•</span>
                                                <span className="flex items-center gap-1">
                                                    <Eye className="w-3 h-3" />
                                                    {announcement.viewCount} views
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleTogglePin(announcement.id)}
                                            className="p-2 text-surface-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                                            title={announcement.isPinned ? 'Unpin' : 'Pin'}
                                        >
                                            {announcement.isPinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                                        </button>
                                        <button
                                            onClick={() => handleEdit(announcement)}
                                            className="p-2 text-surface-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(announcement.id)}
                                            className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-surface-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-scale-in">
                        <div className="flex items-center justify-between p-6 border-b border-surface-100">
                            <h2 className="text-xl font-bold text-surface-800">
                                {editingAnnouncement ? 'Edit Announcement' : 'New Announcement'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-2">Title</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="input"
                                    placeholder="Announcement title..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-2">Content</label>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="input min-h-[120px]"
                                    placeholder="Write your announcement..."
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-2">Type</label>
                                    <select
                                        value={formData.type}
                                        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                        className="input"
                                    >
                                        {typeOptions.map(opt => (
                                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-2">Expires On (Optional)</label>
                                    <input
                                        type="date"
                                        value={formData.expiresAt}
                                        onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                                        className="input"
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="isPinned"
                                    checked={formData.isPinned}
                                    onChange={(e) => setFormData({ ...formData, isPinned: e.target.checked })}
                                    className="w-4 h-4 text-primary-600 rounded"
                                />
                                <label htmlFor="isPinned" className="text-sm text-surface-700">Pin this announcement</label>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingAnnouncement ? 'Update' : 'Create'} Announcement
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Announcements;
