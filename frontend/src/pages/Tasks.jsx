import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { taskAPI, employeeAPI } from '../services/api';
import {
    ClipboardList,
    Plus,
    Edit2,
    Trash2,
    CheckCircle2,
    Clock,
    AlertCircle,
    Calendar,
    User,
    X,
    Play,
    Filter,
    ChevronDown
} from 'lucide-react';

const Tasks = () => {
    const { canManageEmployees, user } = useAuth();
    const { showToast } = useToast();
    const [tasks, setTasks] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [stats, setStats] = useState({ pending: 0, in_progress: 0, completed: 0, overdue: 0 });
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingTask, setEditingTask] = useState(null);
    const [filter, setFilter] = useState({ status: '', priority: '' });
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        assignedTo: '',
        dueDate: '',
        priority: 'medium',
        category: ''
    });

    const priorityOptions = [
        { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
        { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
        { value: 'high', label: 'High', color: 'bg-red-100 text-red-700' },
    ];

    const statusOptions = [
        { value: 'pending', label: 'Pending', icon: Clock, color: 'bg-amber-100 text-amber-700' },
        { value: 'in_progress', label: 'In Progress', icon: Play, color: 'bg-blue-100 text-blue-700' },
        { value: 'completed', label: 'Completed', icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-700' },
    ];

    useEffect(() => {
        fetchData();
    }, [filter]);

    const fetchData = async () => {
        try {
            setLoading(true);

            if (canManageEmployees) {
                const [tasksRes, employeesRes] = await Promise.all([
                    taskAPI.getAll({ ...filter, limit: 100 }),
                    employeeAPI.getAll({ limit: 100 }),
                ]);
                setTasks(tasksRes.data.data.tasks || tasksRes.data.data || []);

                // Handle different employee response structures
                const empData = employeesRes.data.data;
                if (Array.isArray(empData)) {
                    setEmployees(empData);
                } else if (empData?.employees) {
                    setEmployees(empData.employees);
                } else {
                    setEmployees([]);
                    console.log('Employee response:', employeesRes.data);
                }

                // Get stats
                try {
                    const statsRes = await taskAPI.getStats();
                    setStats(statsRes.data.data || { pending: 0, in_progress: 0, completed: 0, overdue: 0 });
                } catch (e) {
                    console.error('Stats error:', e);
                }
            } else {
                const myTasksRes = await taskAPI.getMy();
                setTasks(myTasksRes.data.data.tasks || []);
                setStats(myTasksRes.data.data.stats || { pending: 0, in_progress: 0, completed: 0, overdue: 0 });
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
                ...formData,
                dueDate: formData.dueDate || null
            };

            if (editingTask) {
                await taskAPI.update(editingTask._id, payload);
            } else {
                await taskAPI.create(payload);
            }

            closeModal();
            fetchData();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to save task', 'error');
        }
    };

    const handleStatusChange = async (taskId, newStatus) => {
        try {
            await taskAPI.updateStatus(taskId, { status: newStatus });
            fetchData();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to update status', 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this task?')) return;
        try {
            await taskAPI.delete(id);
            fetchData();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to delete task', 'error');
        }
    };

    const handleEdit = (task) => {
        setEditingTask(task);
        setFormData({
            title: task.title,
            description: task.description || '',
            assignedTo: task.assignedTo?._id || '',
            dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
            priority: task.priority,
            category: task.category || ''
        });
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingTask(null);
        setFormData({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium', category: '' });
    };

    const getPriorityStyle = (priority) => {
        const opt = priorityOptions.find(p => p.value === priority);
        return opt?.color || 'bg-gray-100 text-gray-700';
    };

    const getStatusStyle = (status) => {
        const opt = statusOptions.find(s => s.value === status);
        return opt?.color || 'bg-gray-100 text-gray-700';
    };

    const isOverdue = (task) => {
        if (task.status === 'completed' || task.status === 'cancelled') return false;
        return new Date(task.dueDate) < new Date();
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-surface-800 flex items-center gap-3">
                        <ClipboardList className="w-7 h-7 text-primary-600" />
                        {canManageEmployees ? 'Task Management' : 'My Tasks'}
                    </h1>
                    <p className="text-surface-500 mt-1">
                        {canManageEmployees ? 'Assign and manage employee tasks' : 'View and update your assigned tasks'}
                    </p>
                </div>
                {canManageEmployees && (
                    <button
                        onClick={() => {
                            setEditingTask(null);
                            setFormData({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium', category: '' });
                            setShowModal(true);
                        }}
                        className="btn btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        New Task
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                    { label: 'Pending', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'In Progress', value: stats.in_progress, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Completed', value: stats.completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Overdue', value: stats.overdue, color: 'text-red-600', bg: 'bg-red-50' },
                ].map((stat, i) => (
                    <div key={i} className={`card ${stat.bg} border-none`}>
                        <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                        <p className="text-sm text-surface-600">{stat.label}</p>
                    </div>
                ))}
            </div>

            {/* Filters (Admin/HR only) */}
            {canManageEmployees && (
                <div className="flex flex-wrap gap-3">
                    <select
                        value={filter.status}
                        onChange={(e) => setFilter({ ...filter, status: e.target.value })}
                        className="input w-auto"
                    >
                        <option value="">All Status</option>
                        {statusOptions.map(s => (
                            <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                    </select>
                    <select
                        value={filter.priority}
                        onChange={(e) => setFilter({ ...filter, priority: e.target.value })}
                        className="input w-auto"
                    >
                        <option value="">All Priority</option>
                        {priorityOptions.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Tasks List */}
            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="card animate-pulse">
                            <div className="h-6 bg-surface-200 rounded w-1/3 mb-3"></div>
                            <div className="h-4 bg-surface-200 rounded w-2/3"></div>
                        </div>
                    ))}
                </div>
            ) : tasks.length === 0 ? (
                <div className="card text-center py-12">
                    <ClipboardList className="w-12 h-12 text-surface-300 mx-auto mb-4" />
                    <p className="text-surface-500">No tasks found</p>
                    {canManageEmployees && (
                        <p className="text-sm text-surface-400">Create a new task to get started</p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {tasks.map((task) => (
                        <div
                            key={task._id}
                            className={`card hover:shadow-lg transition-shadow ${isOverdue(task) ? 'border-red-300 bg-red-50/50' : ''}`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                                        <h3 className="font-semibold text-surface-800">{task.title}</h3>
                                        <span className={`badge ${getPriorityStyle(task.priority)} capitalize`}>
                                            {task.priority}
                                        </span>
                                        <span className={`badge ${getStatusStyle(task.status)}`}>
                                            {task.status.replace('_', ' ')}
                                        </span>
                                        {isOverdue(task) && (
                                            <span className="badge bg-red-100 text-red-700">Overdue</span>
                                        )}
                                    </div>
                                    {task.description && (
                                        <p className="text-surface-600 text-sm mb-2 line-clamp-2">{task.description}</p>
                                    )}
                                    <div className="flex flex-wrap items-center gap-4 text-xs text-surface-400">
                                        {canManageEmployees && task.assignedTo && (
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                {task.assignedTo.name}
                                            </span>
                                        )}
                                        <span className="flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            Due: {new Date(task.dueDate).toLocaleDateString()}
                                        </span>
                                        {task.category && (
                                            <span className="badge bg-surface-100 text-surface-600">{task.category}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Status buttons for employees */}
                                    {!canManageEmployees && task.status !== 'completed' && (
                                        <div className="flex gap-1">
                                            {task.status === 'pending' && (
                                                <button
                                                    onClick={() => handleStatusChange(task._id, 'in_progress')}
                                                    className="btn btn-secondary text-xs py-1 px-2"
                                                >
                                                    Start
                                                </button>
                                            )}
                                            {task.status === 'in_progress' && (
                                                <button
                                                    onClick={() => handleStatusChange(task._id, 'completed')}
                                                    className="btn btn-primary text-xs py-1 px-2"
                                                >
                                                    Complete
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    {/* Admin actions */}
                                    {canManageEmployees && (
                                        <>
                                            <select
                                                value={task.status}
                                                onChange={(e) => handleStatusChange(task._id, e.target.value)}
                                                className="input text-xs py-1 px-2 w-auto"
                                            >
                                                {statusOptions.map(s => (
                                                    <option key={s.value} value={s.value}>{s.label}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => handleEdit(task)}
                                                className="p-2 text-surface-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(task._id)}
                                                className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {showModal && canManageEmployees && (
                <div className="fixed inset-0 bg-surface-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-surface-100">
                            <h2 className="text-xl font-bold text-surface-800">
                                {editingTask ? 'Edit Task' : 'New Task'}
                            </h2>
                            <button
                                onClick={closeModal}
                                className="p-2 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-2">Title *</label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="input"
                                    placeholder="Task title..."
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-2">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="input min-h-[80px]"
                                    placeholder="Task description..."
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-2">Assign To *</label>
                                <select
                                    value={formData.assignedTo}
                                    onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                                    className="input"
                                    required
                                >
                                    <option value="">Select Employee</option>
                                    {employees.map(emp => (
                                        <option key={emp._id} value={emp._id}>
                                            {emp.name} - {emp.department}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-2">Due Date *</label>
                                    <input
                                        type="date"
                                        value={formData.dueDate}
                                        onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                                        className="input"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-surface-700 mb-2">Priority</label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                                        className="input"
                                    >
                                        {priorityOptions.map(p => (
                                            <option key={p.value} value={p.value}>{p.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-surface-700 mb-2">Category</label>
                                <input
                                    type="text"
                                    value={formData.category}
                                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                    className="input"
                                    placeholder="e.g., Report, Meeting, Training..."
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="btn btn-secondary"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingTask ? 'Update' : 'Create'} Task
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tasks;
