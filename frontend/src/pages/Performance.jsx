import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { performanceAPI, employeeAPI } from '../services/api';
import {
    Target,
    Star,
    Plus,
    Search,
    Filter,
    ChevronRight,
    Loader2,
    CheckCircle,
    Clock,
    AlertCircle,
    Edit,
    Trash2,
    MessageSquare
} from 'lucide-react';

const Performance = () => {
    const { user, employee, canManageEmployees } = useAuth();
    const [activeTab, setActiveTab] = useState('goals');
    const [goals, setGoals] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [selectedGoal, setSelectedGoal] = useState(null);
    const [employees, setEmployees] = useState([]);
    const [goalForm, setGoalForm] = useState({
        title: '',
        description: '',
        category: 'Performance',
        priority: 'medium',
        dueDate: '',
        employeeId: ''
    });

    useEffect(() => {
        fetchData();
    }, [activeTab]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'goals') {
                const { data } = await performanceAPI.getGoals({ limit: 50 });
                setGoals(data.data || []);
            } else {
                const { data } = await performanceAPI.getReviews({ limit: 50 });
                setReviews(data.data || []);
            }

            if (canManageEmployees) {
                const empRes = await employeeAPI.getAll({ limit: 100 });
                setEmployees(empRes.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGoal = async (e) => {
        e.preventDefault();
        try {
            await performanceAPI.createGoal(goalForm);
            setShowGoalModal(false);
            setGoalForm({
                title: '',
                description: '',
                category: 'Performance',
                priority: 'medium',
                dueDate: '',
                employeeId: ''
            });
            fetchData();
        } catch (error) {
            console.error('Error creating goal:', error);
            alert('Error creating goal');
        }
    };

    const handleUpdateProgress = async (goalId, progress) => {
        try {
            await performanceAPI.updateGoal(goalId, { progress: parseInt(progress) });
            fetchData();
        } catch (error) {
            console.error('Error updating progress:', error);
        }
    };

    const handleDeleteGoal = async (goalId) => {
        if (!confirm('Delete this goal?')) return;
        try {
            await performanceAPI.deleteGoal(goalId);
            fetchData();
        } catch (error) {
            console.error('Error deleting goal:', error);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'completed': return 'text-green-600 bg-green-100';
            case 'in-progress': return 'text-blue-600 bg-blue-100';
            case 'overdue': return 'text-red-600 bg-red-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'critical': return 'text-red-600 bg-red-100';
            case 'high': return 'text-orange-600 bg-orange-100';
            case 'medium': return 'text-yellow-600 bg-yellow-100';
            default: return 'text-gray-600 bg-gray-100';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Performance</h1>
                    <p className="text-gray-500">Track goals and performance reviews</p>
                </div>
                <button
                    onClick={() => setShowGoalModal(true)}
                    className="btn btn-primary flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    New Goal
                </button>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    <button
                        onClick={() => setActiveTab('goals')}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'goals'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Target className="w-4 h-4" />
                        Goals
                    </button>
                    <button
                        onClick={() => setActiveTab('reviews')}
                        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'reviews'
                            ? 'border-primary-500 text-primary-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <Star className="w-4 h-4" />
                        Reviews
                    </button>
                </nav>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
            ) : (
                <>
                    {/* Goals Tab */}
                    {activeTab === 'goals' && (
                        <div className="space-y-4">
                            {goals.length === 0 ? (
                                <div className="card p-12 text-center">
                                    <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-600">No goals yet</h3>
                                    <p className="text-gray-500 mb-4">Create your first goal to start tracking progress</p>
                                    <button
                                        onClick={() => setShowGoalModal(true)}
                                        className="btn btn-primary"
                                    >
                                        Create Goal
                                    </button>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {goals.map(goal => (
                                        <div key={goal._id} className="card p-6 hover:shadow-lg transition-shadow">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <h3 className="font-semibold text-gray-800">{goal.title}</h3>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(goal.status)}`}>
                                                            {goal.status?.replace('-', ' ')}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(goal.priority)}`}>
                                                            {goal.priority}
                                                        </span>
                                                    </div>
                                                    {goal.description && (
                                                        <p className="text-gray-600 text-sm mb-3">{goal.description}</p>
                                                    )}
                                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                                        <span>{goal.category}</span>
                                                        <span>Due: {new Date(goal.dueDate).toLocaleDateString()}</span>
                                                        {goal.employee && (
                                                            <span>Assigned to: {goal.employee.name}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => handleDeleteGoal(goal._id)}
                                                        className="p-2 text-gray-400 hover:text-red-500"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Progress bar */}
                                            <div className="mt-4">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm text-gray-500">Progress</span>
                                                    <span className="text-sm font-medium">{goal.progress || 0}%</span>
                                                </div>
                                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all"
                                                        style={{ width: `${goal.progress || 0}%` }}
                                                    />
                                                </div>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="100"
                                                    value={goal.progress || 0}
                                                    onChange={(e) => handleUpdateProgress(goal._id, e.target.value)}
                                                    className="w-full mt-2 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Reviews Tab */}
                    {activeTab === 'reviews' && (
                        <div className="space-y-4">
                            {reviews.length === 0 ? (
                                <div className="card p-12 text-center">
                                    <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-600">No reviews yet</h3>
                                    <p className="text-gray-500">Performance reviews will appear here</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="table">
                                        <thead>
                                            <tr>
                                                <th>Employee</th>
                                                <th>Period</th>
                                                <th>Overall Rating</th>
                                                <th>Status</th>
                                                <th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reviews.map(review => (
                                                <tr key={review._id}>
                                                    <td>
                                                        <div>
                                                            <p className="font-medium">{review.employee?.name}</p>
                                                            <p className="text-sm text-gray-500">{review.employee?.department}</p>
                                                        </div>
                                                    </td>
                                                    <td>{review.reviewPeriod} {review.year}</td>
                                                    <td>
                                                        <div className="flex items-center gap-1">
                                                            {[1, 2, 3, 4, 5].map(star => (
                                                                <Star
                                                                    key={star}
                                                                    className={`w-4 h-4 ${star <= (review.overallRating || 0)
                                                                        ? 'text-yellow-400 fill-yellow-400'
                                                                        : 'text-gray-300'
                                                                        }`}
                                                                />
                                                            ))}
                                                            <span className="ml-1 text-sm">{review.overallRating?.toFixed(1)}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(review.status)}`}>
                                                            {review.status}
                                                        </span>
                                                    </td>
                                                    <td className="text-gray-500">
                                                        {new Date(review.createdAt).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* Goal Modal */}
            {showGoalModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
                        <div className="p-6 border-b">
                            <h2 className="text-xl font-bold">Create New Goal</h2>
                        </div>
                        <form onSubmit={handleCreateGoal} className="p-6 space-y-4">
                            <div>
                                <label className="form-label">Title</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={goalForm.title}
                                    onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="form-label">Description</label>
                                <textarea
                                    className="form-input"
                                    rows="3"
                                    value={goalForm.description}
                                    onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Category</label>
                                    <select
                                        className="form-input"
                                        value={goalForm.category}
                                        onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value })}
                                    >
                                        <option value="Performance">Performance</option>
                                        <option value="Development">Development</option>
                                        <option value="Project">Project</option>
                                        <option value="Personal">Personal</option>
                                        <option value="Team">Team</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Priority</label>
                                    <select
                                        className="form-input"
                                        value={goalForm.priority}
                                        onChange={(e) => setGoalForm({ ...goalForm, priority: e.target.value })}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Due Date</label>
                                <input
                                    type="date"
                                    className="form-input"
                                    value={goalForm.dueDate}
                                    onChange={(e) => setGoalForm({ ...goalForm, dueDate: e.target.value })}
                                    required
                                />
                            </div>
                            {canManageEmployees && (
                                <div>
                                    <label className="form-label">Assign To (Optional)</label>
                                    <select
                                        className="form-input"
                                        value={goalForm.employeeId}
                                        onChange={(e) => setGoalForm({ ...goalForm, employeeId: e.target.value })}
                                    >
                                        <option value="">Self</option>
                                        {employees.map(emp => (
                                            <option key={emp._id} value={emp._id}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowGoalModal(false)}
                                    className="btn btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary flex-1">
                                    Create Goal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Performance;
