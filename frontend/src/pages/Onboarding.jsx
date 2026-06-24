import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { onboardingAPI, employeeAPI } from '../services/api';
import {
    ClipboardList,
    CheckCircle,
    Circle,
    Clock,
    Users,
    Plus,
    Search,
    Loader2,
    ChevronRight,
    MessageSquare,
    User,
    Calendar,
    Trash2
} from 'lucide-react';

const Onboarding = () => {
    const { canManageEmployees } = useAuth();
    const { showToast } = useToast();
    const [onboardings, setOnboardings] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [selectedOnboarding, setSelectedOnboarding] = useState(null);
    const [filter, setFilter] = useState('all');
    const [createForm, setCreateForm] = useState({
        employeeId: '',
        startDate: new Date().toISOString().split('T')[0],
        mentorId: ''
    });

    useEffect(() => {
        fetchData();
    }, [filter]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const params = filter !== 'all' ? { status: filter } : {};
            const { data } = await onboardingAPI.getAll(params);
            setOnboardings(data.data || []);

            if (canManageEmployees) {
                const empRes = await employeeAPI.getAll({ limit: 100 });
                setEmployees(empRes.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching onboarding data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            await onboardingAPI.create(createForm);
            setShowCreateModal(false);
            setCreateForm({
                employeeId: '',
                startDate: new Date().toISOString().split('T')[0],
                mentorId: ''
            });
            fetchData();
        } catch (error) {
            console.error('Error creating onboarding:', error);
            showToast(error.response?.data?.message || 'Error creating onboarding', 'error');
        }
    };

    const handleTaskToggle = async (onboardingId, taskId, completed) => {
        try {
            await onboardingAPI.updateTask(onboardingId, taskId, { completed: !completed });
            // Refresh selected onboarding
            if (selectedOnboarding?._id === onboardingId) {
                const { data } = await onboardingAPI.getById(onboardingId);
                setSelectedOnboarding(data.data);
            }
            fetchData();
        } catch (error) {
            console.error('Error updating task:', error);
        }
    };

    const handleDelete = async (e, onboardingId) => {
        e.stopPropagation();
        if (!window.confirm('Are you sure you want to delete this onboarding record? This action cannot be undone.')) {
            return;
        }
        try {
            await onboardingAPI.delete(onboardingId);
            if (selectedOnboarding?._id === onboardingId) {
                setSelectedOnboarding(null);
            }
            fetchData();
        } catch (error) {
            console.error('Error deleting onboarding:', error);
            showToast(error.response?.data?.message || 'Error deleting onboarding', 'error');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-600';
            case 'in-progress': return 'bg-blue-100 text-blue-600';
            case 'overdue': return 'bg-red-100 text-red-600';
            default: return 'bg-gray-100 text-gray-600';
        }
    };

    const getCategoryColor = (category) => {
        const colors = {
            documentation: 'bg-purple-100 text-purple-600',
            training: 'bg-blue-100 text-blue-600',
            equipment: 'bg-yellow-100 text-yellow-600',
            access: 'bg-green-100 text-green-600',
            introduction: 'bg-pink-100 text-pink-600',
            other: 'bg-gray-100 text-gray-600'
        };
        return colors[category] || colors.other;
    };

    if (!canManageEmployees) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl text-gray-600">Access Denied</h2>
                <p className="text-gray-500">You don't have permission to access onboarding.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Onboarding</h1>
                    <p className="text-gray-500">Manage new employee onboarding process</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Start Onboarding
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2 overflow-x-auto">
                {['all', 'not-started', 'in-progress', 'completed'].map(status => (
                    <button
                        key={status}
                        onClick={() => setFilter(status)}
                        className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors ${filter === status
                            ? 'bg-primary-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        {status === 'all' ? 'All' : status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
            ) : onboardings.length === 0 ? (
                <div className="card p-12 text-center">
                    <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600">No onboarding records</h3>
                    <p className="text-gray-500 mb-4">Start onboarding for a new employee</p>
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn btn-primary"
                    >
                        Start Onboarding
                    </button>
                </div>
            ) : (
                <div className="grid gap-4">
                    {onboardings.map(onboarding => (
                        <div
                            key={onboarding._id}
                            className="card p-6 hover:shadow-lg transition-shadow cursor-pointer"
                            onClick={() => setSelectedOnboarding(onboarding)}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                                        <User className="w-6 h-6 text-primary-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">
                                            {onboarding.employee?.name}
                                        </h3>
                                        <p className="text-sm text-gray-500">
                                            {onboarding.employee?.department} • {onboarding.employee?.position}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(onboarding.status)}`}>
                                        {onboarding.status?.replace('-', ' ')}
                                    </span>
                                    <button
                                        onClick={(e) => handleDelete(e, onboarding._id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Delete onboarding"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="mt-4">
                                <div className="flex items-center justify-between mb-1 text-sm">
                                    <span className="text-gray-500">Progress</span>
                                    <span className="font-medium">{onboarding.progress || 0}%</span>
                                </div>
                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all"
                                        style={{ width: `${onboarding.progress || 0}%` }}
                                    />
                                </div>
                            </div>

                            <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    Started: {new Date(onboarding.startDate).toLocaleDateString()}
                                </span>
                                <span>
                                    {onboarding.tasks?.filter(t => t.completed).length}/{onboarding.tasks?.length} tasks
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md animate-fade-in">
                        <div className="p-6 border-b">
                            <h2 className="text-xl font-bold">Start Onboarding</h2>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div>
                                <label className="form-label">Select Employee</label>
                                <select
                                    className="form-input"
                                    value={createForm.employeeId}
                                    onChange={(e) => setCreateForm({ ...createForm, employeeId: e.target.value })}
                                    required
                                >
                                    <option value="">Select an employee...</option>
                                    {employees.map(emp => (
                                        <option key={emp._id} value={emp._id}>
                                            {emp.name} - {emp.department}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="form-label">Start Date</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={createForm.startDate}
                                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="form-label">Assign Mentor (Optional)</label>
                                <select
                                    className="form-input"
                                    value={createForm.mentorId}
                                    onChange={(e) => setCreateForm({ ...createForm, mentorId: e.target.value })}
                                >
                                    <option value="">No mentor</option>
                                    {employees.map(emp => (
                                        <option key={emp._id} value={emp._id}>{emp.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="btn btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary flex-1">
                                    Start Onboarding
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Detail Modal */}
            {selectedOnboarding && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
                        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white">
                            <div>
                                <h2 className="text-xl font-bold">{selectedOnboarding.employee?.name}</h2>
                                <p className="text-gray-500">
                                    {selectedOnboarding.employee?.department} • {selectedOnboarding.employee?.position}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => handleDelete(e, selectedOnboarding._id)}
                                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1.5"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete
                                </button>
                                <button
                                    onClick={() => setSelectedOnboarding(null)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* Progress */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="font-medium">Overall Progress</h3>
                                    <span className="text-2xl font-bold text-primary-600">{selectedOnboarding.progress || 0}%</span>
                                </div>
                                <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all"
                                        style={{ width: `${selectedOnboarding.progress || 0}%` }}
                                    />
                                </div>
                            </div>

                            {/* Tasks */}
                            <div>
                                <h3 className="font-medium mb-3">Tasks</h3>
                                <div className="space-y-2">
                                    {selectedOnboarding.tasks?.map(task => (
                                        <div
                                            key={task._id}
                                            className={`flex items-center gap-3 p-3 rounded-lg border ${task.completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                                                }`}
                                        >
                                            <button
                                                onClick={() => handleTaskToggle(selectedOnboarding._id, task._id, task.completed)}
                                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${task.completed
                                                    ? 'bg-green-500 border-green-500 text-white'
                                                    : 'border-gray-300 hover:border-primary-500'
                                                    }`}
                                            >
                                                {task.completed && <CheckCircle className="w-4 h-4" />}
                                            </button>
                                            <div className="flex-1">
                                                <p className={`font-medium ${task.completed ? 'line-through text-gray-400' : ''}`}>
                                                    {task.title}
                                                </p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${getCategoryColor(task.category)}`}>
                                                        {task.category}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        Assigned to: {task.assignedTo}
                                                    </span>
                                                    <span className="text-xs text-gray-500">
                                                        Due: {new Date(task.dueDate).toLocaleDateString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Mentor */}
                            {selectedOnboarding.mentor && (
                                <div className="bg-gray-50 rounded-xl p-4">
                                    <h4 className="font-medium mb-2">Assigned Mentor</h4>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
                                            <User className="w-5 h-5 text-primary-600" />
                                        </div>
                                        <div>
                                            <p className="font-medium">{selectedOnboarding.mentor.name}</p>
                                            <p className="text-sm text-gray-500">{selectedOnboarding.mentor.email}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Onboarding;
