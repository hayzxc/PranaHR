import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { okrAPI, employeeAPI, performanceAPI } from '../services/api';
import {
    Crosshair,
    Plus,
    Loader2,
    ChevronRight,
    ChevronDown,
    Trash2,
    Edit,
    TrendingUp,
    TrendingDown,
    Minus,
    BarChart3,
    Target,
    Activity,
    Award,
    AlertCircle,
    CheckCircle,
    Clock,
    X,
    Save,
    Star,
    ClipboardList,
} from 'lucide-react';

const OKR = () => {
    const { user, employee, canManageEmployees } = useAuth();
    const { showToast } = useToast();
    const [activeTab, setActiveTab] = useState('goals');
    const [okrs, setOkrs] = useState([]);
    const [kpis, setKpis] = useState([]);
    const [goals, setGoals] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showOKRModal, setShowOKRModal] = useState(false);
    const [showKPIModal, setShowKPIModal] = useState(false);
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [showEntryModal, setShowEntryModal] = useState(null); // KPI id
    const [expandedOKR, setExpandedOKR] = useState(null);
    const [filters, setFilters] = useState({
        cycle: '', year: new Date().getFullYear(), status: '',
    });

    const [okrForm, setOkrForm] = useState({
        title: '', description: '', cycle: 'Q1', year: new Date().getFullYear(),
        category: 'individual', employeeId: '',
        keyResults: [{ title: '', targetValue: 100, unit: '%', weight: 1 }],
    });

    const [kpiForm, setKpiForm] = useState({
        name: '', description: '', unit: '%', targetValue: 100,
        frequency: 'monthly', category: 'productivity', employeeId: '',
    });

    const [entryForm, setEntryForm] = useState({
        value: '', date: new Date().toISOString().split('T')[0], notes: '',
    });

    const [goalForm, setGoalForm] = useState({
        title: '', description: '', category: 'Performance',
        priority: 'medium', dueDate: '', employeeId: '',
    });

    useEffect(() => {
        fetchData();
    }, [activeTab, filters]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (activeTab === 'okrs' || activeTab === 'team') {
                const params = { limit: 50 };
                if (filters.cycle) params.cycle = filters.cycle;
                if (filters.year) params.year = filters.year;
                if (filters.status) params.status = filters.status;

                const { data } = await okrAPI.getAll(params);
                setOkrs(data.data || []);
            }

            if (activeTab === 'kpis') {
                const { data } = await okrAPI.getKPIs({ limit: 50 });
                setKpis(data.data || []);
            }

            if (activeTab === 'goals') {
                const { data } = await performanceAPI.getGoals({ limit: 50 });
                setGoals(data.data || []);
            }

            if (activeTab === 'reviews') {
                const { data } = await performanceAPI.getReviews({ limit: 50 });
                setReviews(data.data || []);
            }

            if (canManageEmployees) {
                try {
                    const [empRes, statsRes] = await Promise.all([
                        employeeAPI.getAll({ limit: 100 }),
                        okrAPI.getStats({ year: filters.year }),
                    ]);
                    setEmployees(empRes.data.data || []);
                    setStats(statsRes.data.data || null);
                } catch {
                    // Stats endpoint might fail for non-admin
                }
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    // ============ OKR HANDLERS ============

    const handleCreateOKR = async (e) => {
        e.preventDefault();
        try {
            await okrAPI.create(okrForm);
            setShowOKRModal(false);
            setOkrForm({
                title: '', description: '', cycle: 'Q1', year: new Date().getFullYear(),
                category: 'individual', employeeId: '',
                keyResults: [{ title: '', targetValue: 100, unit: '%', weight: 1 }],
            });
            fetchData();
        } catch (error) {
            console.error('Error creating OKR:', error);
            showToast(error.response?.data?.message || 'Error creating OKR', 'error');
        }
    };

    const handleUpdateKR = async (okrId, krIndex, currentValue) => {
        try {
            await okrAPI.updateKeyResult(okrId, krIndex, { currentValue: parseFloat(currentValue) });
            fetchData();
        } catch (error) {
            console.error('Error updating KR:', error);
        }
    };

    const handleUpdateOKRStatus = async (okrId, status) => {
        try {
            await okrAPI.update(okrId, { status });
            fetchData();
        } catch (error) {
            console.error('Error updating OKR status:', error);
        }
    };

    const handleDeleteOKR = async (id) => {
        if (!confirm('Delete this OKR?')) return;
        try {
            await okrAPI.delete(id);
            fetchData();
        } catch (error) {
            console.error('Error deleting OKR:', error);
        }
    };

    const addKeyResult = () => {
        if (okrForm.keyResults.length >= 10) return;
        setOkrForm({
            ...okrForm,
            keyResults: [...okrForm.keyResults, { title: '', targetValue: 100, unit: '%', weight: 1 }],
        });
    };

    const removeKeyResult = (idx) => {
        if (okrForm.keyResults.length <= 1) return;
        setOkrForm({
            ...okrForm,
            keyResults: okrForm.keyResults.filter((_, i) => i !== idx),
        });
    };

    const updateKeyResultForm = (idx, field, value) => {
        const updated = [...okrForm.keyResults];
        updated[idx] = { ...updated[idx], [field]: value };
        setOkrForm({ ...okrForm, keyResults: updated });
    };

    // ============ KPI HANDLERS ============

    const handleCreateKPI = async (e) => {
        e.preventDefault();
        try {
            await okrAPI.createKPI(kpiForm);
            setShowKPIModal(false);
            setKpiForm({
                name: '', description: '', unit: '%', targetValue: 100,
                frequency: 'monthly', category: 'productivity', employeeId: '',
            });
            fetchData();
        } catch (error) {
            console.error('Error creating KPI:', error);
            showToast(error.response?.data?.message || 'Error creating KPI', 'error');
        }
    };

    const handleAddEntry = async (e) => {
        e.preventDefault();
        try {
            await okrAPI.addKPIEntry(showEntryModal, {
                value: parseFloat(entryForm.value),
                date: entryForm.date,
                notes: entryForm.notes,
            });
            setShowEntryModal(null);
            setEntryForm({ value: '', date: new Date().toISOString().split('T')[0], notes: '' });
            fetchData();
        } catch (error) {
            console.error('Error adding entry:', error);
            showToast(error.response?.data?.message || 'Error adding entry', 'error');
        }
    };

    const handleDeleteKPI = async (id) => {
        if (!confirm('Delete this KPI?')) return;
        try {
            await okrAPI.deleteKPI(id);
            fetchData();
        } catch (error) {
            console.error('Error deleting KPI:', error);
        }
    };

    // ============ GOAL HANDLERS ============

    const handleCreateGoal = async (e) => {
        e.preventDefault();
        try {
            await performanceAPI.createGoal(goalForm);
            setShowGoalModal(false);
            setGoalForm({ title: '', description: '', category: 'Performance', priority: 'medium', dueDate: '', employeeId: '' });
            fetchData();
        } catch (error) {
            console.error('Error creating goal:', error);
            showToast('Error creating goal', 'error');
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

    const getGoalStatusColor = (status) => {
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

    // ============ HELPERS ============

    const getScoreColor = (score) => {
        if (score >= 0.7) return 'text-emerald-600';
        if (score >= 0.4) return 'text-amber-600';
        return 'text-red-500';
    };

    const getScoreBg = (score) => {
        if (score >= 0.7) return 'bg-emerald-500';
        if (score >= 0.4) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'active': return 'badge-success';
            case 'completed': return 'badge-primary';
            case 'draft': return 'badge-neutral';
            case 'cancelled': return 'badge-danger';
            default: return 'badge-neutral';
        }
    };

    const getTrendIcon = (trend) => {
        switch (trend) {
            case 'improving': return <TrendingUp className="w-4 h-4 text-emerald-500" />;
            case 'declining': return <TrendingDown className="w-4 h-4 text-red-500" />;
            case 'stable': return <Minus className="w-4 h-4 text-amber-500" />;
            default: return <Activity className="w-4 h-4 text-gray-400" />;
        }
    };

    const getKRProgress = (kr) => {
        if (!kr.targetValue) return 0;
        return Math.min(Math.round((kr.currentValue / kr.targetValue) * 100), 100);
    };

    // Group OKRs by department for team view
    const groupedOKRs = okrs.reduce((acc, okr) => {
        const dept = okr.owner?.department || 'Unknown';
        if (!acc[dept]) acc[dept] = [];
        acc[dept].push(okr);
        return acc;
    }, {});

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <Crosshair className="w-7 h-7 text-primary-600" />
                        Performance & KPI
                    </h1>
                    <p className="text-gray-500">Track goals, objectives, key results, and performance indicators</p>
                </div>
                <div className="flex gap-2">
                    {(activeTab === 'goals') && (
                        <button onClick={() => setShowGoalModal(true)} className="btn btn-primary flex items-center gap-2">
                            <Plus className="w-4 h-4" /> New Goal
                        </button>
                    )}
                    {(activeTab === 'okrs' || activeTab === 'team') && (
                        <button onClick={() => setShowOKRModal(true)} className="btn btn-primary flex items-center gap-2">
                            <Plus className="w-4 h-4" /> New OKR
                        </button>
                    )}
                    {activeTab === 'kpis' && canManageEmployees && (
                        <button onClick={() => setShowKPIModal(true)} className="btn btn-accent flex items-center gap-2">
                            <Plus className="w-4 h-4" /> New KPI
                        </button>
                    )}
                </div>
            </div>

            {/* Stat Cards (admin/hr) */}
            {stats && canManageEmployees && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="stat-card">
                        <div className="stat-icon gradient-primary text-white"><Target className="w-6 h-6" /></div>
                        <div>
                            <div className="stat-value">{stats.totalOKRs || 0}</div>
                            <div className="stat-label">Total OKRs</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon gradient-success text-white"><CheckCircle className="w-6 h-6" /></div>
                        <div>
                            <div className="stat-value">
                                {stats.statusBreakdown?.find(s => s._id === 'completed')?.count || 0}
                            </div>
                            <div className="stat-label">Completed</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon gradient-warning text-white"><Clock className="w-6 h-6" /></div>
                        <div>
                            <div className="stat-value">
                                {stats.statusBreakdown?.find(s => s._id === 'active')?.count || 0}
                            </div>
                            <div className="stat-label">Active</div>
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon bg-gradient-to-br from-purple-500 to-indigo-600 text-white"><Award className="w-6 h-6" /></div>
                        <div>
                            <div className="stat-value">
                                {stats.statusBreakdown?.length > 0
                                    ? (stats.statusBreakdown.reduce((sum, s) => sum + (s.avgScore || 0), 0) / stats.statusBreakdown.length * 100).toFixed(0) + '%'
                                    : '—'}
                            </div>
                            <div className="stat-label">Avg Score</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4">
                    {['goals', 'reviews', 'okrs', ...(canManageEmployees ? ['team'] : []), 'kpis'].map(tab => (
                        <button
                            key={tab}
                            id={`tab-${tab}`}
                            onClick={() => setActiveTab(tab)}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors capitalize font-medium ${activeTab === tab
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            {tab === 'goals' && <ClipboardList className="w-4 h-4" />}
                            {tab === 'reviews' && <Star className="w-4 h-4" />}
                            {tab === 'okrs' && <Target className="w-4 h-4" />}
                            {tab === 'team' && <BarChart3 className="w-4 h-4" />}
                            {tab === 'kpis' && <Activity className="w-4 h-4" />}
                            {{ goals: 'Goals', reviews: 'Reviews', okrs: 'My OKRs', team: 'Team OKRs', kpis: 'KPI Dashboard' }[tab]}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Filters (for OKR tabs) */}
            {(activeTab === 'okrs' || activeTab === 'team') && (
                <div className="flex flex-wrap gap-3">
                    <select
                        id="filter-cycle"
                        className="form-input w-32"
                        value={filters.cycle}
                        onChange={(e) => setFilters({ ...filters, cycle: e.target.value })}
                    >
                        <option value="">All Cycles</option>
                        {['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Annual'].map(c => (
                            <option key={c} value={c}>{c}</option>
                        ))}
                    </select>
                    <select
                        id="filter-status"
                        className="form-input w-32"
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    >
                        <option value="">All Status</option>
                        {['draft', 'active', 'completed', 'cancelled'].map(s => (
                            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                    </select>
                    <input
                        type="number"
                        id="filter-year"
                        className="form-input w-28"
                        value={filters.year}
                        onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
                        min="2020" max="2100"
                    />
                </div>
            )}

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
            ) : (
                <>
                    {/* ============ GOALS TAB ============ */}
                    {activeTab === 'goals' && (
                        <div className="space-y-4">
                            {goals.length === 0 ? (
                                <div className="card p-12 text-center">
                                    <ClipboardList className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-600">No goals yet</h3>
                                    <p className="text-gray-500 mb-4">Create your first goal to start tracking progress</p>
                                    <button onClick={() => setShowGoalModal(true)} className="btn btn-primary">Create Goal</button>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {goals.map(goal => (
                                        <div key={goal._id} className="card p-6 hover:shadow-lg transition-shadow">
                                            <div className="flex items-start justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <h3 className="font-semibold text-gray-800">{goal.title}</h3>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getGoalStatusColor(goal.status)}`}>
                                                            {goal.status?.replace('-', ' ')}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(goal.priority)}`}>
                                                            {goal.priority}
                                                        </span>
                                                    </div>
                                                    {goal.description && <p className="text-gray-600 text-sm mb-3">{goal.description}</p>}
                                                    <div className="flex items-center gap-4 text-sm text-gray-500">
                                                        <span>{goal.category}</span>
                                                        <span>Due: {new Date(goal.dueDate).toLocaleDateString()}</span>
                                                        {goal.employee && <span>Assigned to: {goal.employee.name}</span>}
                                                    </div>
                                                </div>
                                                <button onClick={() => handleDeleteGoal(goal._id)} className="p-2 text-gray-400 hover:text-red-500">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                            <div className="mt-4">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm text-gray-500">Progress</span>
                                                    <span className="text-sm font-medium">{goal.progress || 0}%</span>
                                                </div>
                                                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                    <div className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all" style={{ width: `${goal.progress || 0}%` }} />
                                                </div>
                                                <input type="range" min="0" max="100" value={goal.progress || 0}
                                                    onChange={(e) => handleUpdateProgress(goal._id, e.target.value)}
                                                    className="w-full mt-2 cursor-pointer" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ============ REVIEWS TAB ============ */}
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
                                                                <Star key={star} className={`w-4 h-4 ${star <= (review.overallRating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                                                            ))}
                                                            <span className="ml-1 text-sm">{review.overallRating?.toFixed(1)}</span>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getGoalStatusColor(review.status)}`}>
                                                            {review.status}
                                                        </span>
                                                    </td>
                                                    <td className="text-gray-500">{new Date(review.createdAt).toLocaleDateString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ============ MY OKRs TAB ============ */}
                    {activeTab === 'okrs' && (
                        <div className="space-y-4">
                            {okrs.length === 0 ? (
                                <div className="card p-12 text-center">
                                    <Crosshair className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-600">No OKRs yet</h3>
                                    <p className="text-gray-500 mb-4">Create your first objective to start tracking</p>
                                    <button onClick={() => setShowOKRModal(true)} className="btn btn-primary">
                                        Create OKR
                                    </button>
                                </div>
                            ) : (
                                okrs.map(okr => (
                                    <OKRCard
                                        key={okr._id}
                                        okr={okr}
                                        expanded={expandedOKR === okr._id}
                                        onToggle={() => setExpandedOKR(expandedOKR === okr._id ? null : okr._id)}
                                        onUpdateKR={handleUpdateKR}
                                        onUpdateStatus={handleUpdateOKRStatus}
                                        onDelete={handleDeleteOKR}
                                        getScoreColor={getScoreColor}
                                        getScoreBg={getScoreBg}
                                        getStatusBadge={getStatusBadge}
                                        getKRProgress={getKRProgress}
                                    />
                                ))
                            )}
                        </div>
                    )}

                    {/* ============ TEAM OKRs TAB ============ */}
                    {activeTab === 'team' && (
                        <div className="space-y-6">
                            {Object.keys(groupedOKRs).length === 0 ? (
                                <div className="card p-12 text-center">
                                    <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-600">No team OKRs found</h3>
                                    <p className="text-gray-500">OKRs from all employees will appear here</p>
                                </div>
                            ) : (
                                Object.entries(groupedOKRs).map(([dept, deptOkrs]) => (
                                    <div key={dept} className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-lg font-bold text-gray-700">{dept}</h3>
                                            <span className="badge badge-neutral">{deptOkrs.length} OKRs</span>
                                            {stats?.avgScoreByDept?.find(d => d._id === dept) && (
                                                <span className={`text-sm font-semibold ${getScoreColor(
                                                    stats.avgScoreByDept.find(d => d._id === dept).avgScore
                                                )}`}>
                                                    Avg: {(stats.avgScoreByDept.find(d => d._id === dept).avgScore * 100).toFixed(0)}%
                                                </span>
                                            )}
                                        </div>
                                        {deptOkrs.map(okr => (
                                            <OKRCard
                                                key={okr._id}
                                                okr={okr}
                                                expanded={expandedOKR === okr._id}
                                                onToggle={() => setExpandedOKR(expandedOKR === okr._id ? null : okr._id)}
                                                onUpdateKR={handleUpdateKR}
                                                onUpdateStatus={handleUpdateOKRStatus}
                                                onDelete={handleDeleteOKR}
                                                getScoreColor={getScoreColor}
                                                getScoreBg={getScoreBg}
                                                getStatusBadge={getStatusBadge}
                                                getKRProgress={getKRProgress}
                                                showOwner
                                            />
                                        ))}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* ============ KPI DASHBOARD TAB ============ */}
                    {activeTab === 'kpis' && (
                        <div className="space-y-4">
                            {kpis.length === 0 ? (
                                <div className="card p-12 text-center">
                                    <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-600">No KPIs yet</h3>
                                    <p className="text-gray-500 mb-4">
                                        {canManageEmployees ? 'Create KPIs to track team performance metrics' : 'Your manager will assign KPIs to you'}
                                    </p>
                                    {canManageEmployees && (
                                        <button onClick={() => setShowKPIModal(true)} className="btn btn-accent">
                                            Create KPI
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                    {kpis.map(kpi => (
                                        <KPICard
                                            key={kpi._id}
                                            kpi={kpi}
                                            onAddEntry={() => setShowEntryModal(kpi._id)}
                                            onDelete={handleDeleteKPI}
                                            getTrendIcon={getTrendIcon}
                                            canManageEmployees={canManageEmployees}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}

            {/* ============ CREATE OKR MODAL ============ */}
            {showOKRModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-xl font-bold">Create New OKR</h2>
                            <button onClick={() => setShowOKRModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateOKR} className="p-6 space-y-4">
                            <div>
                                <label className="form-label">Objective Title</label>
                                <input
                                    id="okr-title"
                                    type="text" className="form-input"
                                    value={okrForm.title}
                                    onChange={(e) => setOkrForm({ ...okrForm, title: e.target.value })}
                                    placeholder="e.g., Increase customer satisfaction"
                                    required
                                />
                            </div>
                            <div>
                                <label className="form-label">Description</label>
                                <textarea
                                    id="okr-description"
                                    className="form-input" rows="2"
                                    value={okrForm.description}
                                    onChange={(e) => setOkrForm({ ...okrForm, description: e.target.value })}
                                    placeholder="What do you want to achieve?"
                                />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="form-label">Cycle</label>
                                    <select id="okr-cycle" className="form-input" value={okrForm.cycle}
                                        onChange={(e) => setOkrForm({ ...okrForm, cycle: e.target.value })}>
                                        {['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Annual'].map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Year</label>
                                    <input id="okr-year" type="number" className="form-input" value={okrForm.year}
                                        onChange={(e) => setOkrForm({ ...okrForm, year: parseInt(e.target.value) })}
                                        min="2020" max="2100" />
                                </div>
                                <div>
                                    <label className="form-label">Category</label>
                                    <select id="okr-category" className="form-input" value={okrForm.category}
                                        onChange={(e) => setOkrForm({ ...okrForm, category: e.target.value })}>
                                        <option value="individual">Individual</option>
                                        <option value="team">Team</option>
                                        <option value="department">Department</option>
                                        <option value="company">Company</option>
                                    </select>
                                </div>
                            </div>

                            {canManageEmployees && (
                                <div>
                                    <label className="form-label">Assign To</label>
                                    <select id="okr-assignee" className="form-input" value={okrForm.employeeId}
                                        onChange={(e) => setOkrForm({ ...okrForm, employeeId: e.target.value })}>
                                        <option value="">Self</option>
                                        {employees.map(emp => (
                                            <option key={emp._id} value={emp._id}>{emp.name} — {emp.department}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Key Results */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="form-label mb-0">Key Results</label>
                                    <button type="button" onClick={addKeyResult}
                                        className="text-sm text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1">
                                        <Plus className="w-3 h-3" /> Add KR
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {okrForm.keyResults.map((kr, idx) => (
                                        <div key={idx} className="p-4 bg-gray-50 rounded-xl space-y-3 relative">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-gray-400">KR {idx + 1}</span>
                                                {okrForm.keyResults.length > 1 && (
                                                    <button type="button" onClick={() => removeKeyResult(idx)}
                                                        className="text-red-400 hover:text-red-600 p-1">
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                )}
                                            </div>
                                            <input
                                                type="text" className="form-input"
                                                placeholder="e.g., Achieve NPS score of 80"
                                                value={kr.title}
                                                onChange={(e) => updateKeyResultForm(idx, 'title', e.target.value)}
                                                required
                                            />
                                            <div className="grid grid-cols-3 gap-3">
                                                <div>
                                                    <label className="text-xs text-gray-500 mb-1 block">Target</label>
                                                    <input type="number" className="form-input" value={kr.targetValue}
                                                        onChange={(e) => updateKeyResultForm(idx, 'targetValue', parseFloat(e.target.value))}
                                                        min="0" required />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 mb-1 block">Unit</label>
                                                    <input type="text" className="form-input" value={kr.unit}
                                                        onChange={(e) => updateKeyResultForm(idx, 'unit', e.target.value)}
                                                        placeholder="%" />
                                                </div>
                                                <div>
                                                    <label className="text-xs text-gray-500 mb-1 block">Weight</label>
                                                    <input type="number" className="form-input" value={kr.weight}
                                                        onChange={(e) => updateKeyResultForm(idx, 'weight', parseFloat(e.target.value))}
                                                        min="0.1" max="10" step="0.1" />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowOKRModal(false)} className="btn btn-secondary flex-1">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary flex-1">
                                    Create OKR
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============ CREATE KPI MODAL ============ */}
            {showKPIModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-xl font-bold">Create New KPI</h2>
                            <button onClick={() => setShowKPIModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateKPI} className="p-6 space-y-4">
                            <div>
                                <label className="form-label">KPI Name</label>
                                <input id="kpi-name" type="text" className="form-input" value={kpiForm.name}
                                    onChange={(e) => setKpiForm({ ...kpiForm, name: e.target.value })}
                                    placeholder="e.g., Monthly Sales Revenue" required />
                            </div>
                            <div>
                                <label className="form-label">Description</label>
                                <textarea id="kpi-description" className="form-input" rows="2" value={kpiForm.description}
                                    onChange={(e) => setKpiForm({ ...kpiForm, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Target Value</label>
                                    <input id="kpi-target" type="number" className="form-input" value={kpiForm.targetValue}
                                        onChange={(e) => setKpiForm({ ...kpiForm, targetValue: parseFloat(e.target.value) })}
                                        min="0" required />
                                </div>
                                <div>
                                    <label className="form-label">Unit</label>
                                    <input id="kpi-unit" type="text" className="form-input" value={kpiForm.unit}
                                        onChange={(e) => setKpiForm({ ...kpiForm, unit: e.target.value })}
                                        placeholder="%, Rp, pcs" required />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Frequency</label>
                                    <select id="kpi-frequency" className="form-input" value={kpiForm.frequency}
                                        onChange={(e) => setKpiForm({ ...kpiForm, frequency: e.target.value })}>
                                        <option value="daily">Daily</option>
                                        <option value="weekly">Weekly</option>
                                        <option value="monthly">Monthly</option>
                                        <option value="quarterly">Quarterly</option>
                                        <option value="annually">Annually</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Category</label>
                                    <select id="kpi-category" className="form-input" value={kpiForm.category}
                                        onChange={(e) => setKpiForm({ ...kpiForm, category: e.target.value })}>
                                        <option value="productivity">Productivity</option>
                                        <option value="quality">Quality</option>
                                        <option value="efficiency">Efficiency</option>
                                        <option value="engagement">Engagement</option>
                                        <option value="financial">Financial</option>
                                        <option value="customer">Customer</option>
                                        <option value="custom">Custom</option>
                                    </select>
                                </div>
                            </div>
                            {canManageEmployees && (
                                <div>
                                    <label className="form-label">Assign To</label>
                                    <select id="kpi-assignee" className="form-input" value={kpiForm.employeeId}
                                        onChange={(e) => setKpiForm({ ...kpiForm, employeeId: e.target.value })}>
                                        <option value="">Self</option>
                                        {employees.map(emp => (
                                            <option key={emp._id} value={emp._id}>{emp.name} — {emp.department}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowKPIModal(false)} className="btn btn-secondary flex-1">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-accent flex-1">
                                    Create KPI
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============ ADD KPI ENTRY MODAL ============ */}
            {showEntryModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-md animate-fade-in">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-xl font-bold">Log KPI Entry</h2>
                            <button onClick={() => setShowEntryModal(null)} className="p-2 hover:bg-gray-100 rounded-xl">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleAddEntry} className="p-6 space-y-4">
                            <div>
                                <label className="form-label">Value</label>
                                <input id="entry-value" type="number" className="form-input" value={entryForm.value}
                                    onChange={(e) => setEntryForm({ ...entryForm, value: e.target.value })}
                                    step="any" required />
                            </div>
                            <div>
                                <label className="form-label">Date</label>
                                <input id="entry-date" type="date" className="form-input" value={entryForm.date}
                                    onChange={(e) => setEntryForm({ ...entryForm, date: e.target.value })} />
                            </div>
                            <div>
                                <label className="form-label">Notes (optional)</label>
                                <textarea id="entry-notes" className="form-input" rows="2" value={entryForm.notes}
                                    onChange={(e) => setEntryForm({ ...entryForm, notes: e.target.value })} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setShowEntryModal(null)} className="btn btn-secondary flex-1">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary flex-1 flex items-center justify-center gap-2">
                                    <Save className="w-4 h-4" /> Save Entry
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============ CREATE GOAL MODAL ============ */}
            {showGoalModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in">
                        <div className="p-6 border-b flex items-center justify-between">
                            <h2 className="text-xl font-bold">Create New Goal</h2>
                            <button onClick={() => setShowGoalModal(false)} className="p-2 hover:bg-gray-100 rounded-xl">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreateGoal} className="p-6 space-y-4">
                            <div>
                                <label className="form-label">Title</label>
                                <input type="text" className="form-input" value={goalForm.title}
                                    onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })} required />
                            </div>
                            <div>
                                <label className="form-label">Description</label>
                                <textarea className="form-input" rows="3" value={goalForm.description}
                                    onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="form-label">Category</label>
                                    <select className="form-input" value={goalForm.category}
                                        onChange={(e) => setGoalForm({ ...goalForm, category: e.target.value })}>
                                        <option value="Performance">Performance</option>
                                        <option value="Development">Development</option>
                                        <option value="Project">Project</option>
                                        <option value="Personal">Personal</option>
                                        <option value="Team">Team</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="form-label">Priority</label>
                                    <select className="form-input" value={goalForm.priority}
                                        onChange={(e) => setGoalForm({ ...goalForm, priority: e.target.value })}>
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="form-label">Due Date</label>
                                <input type="date" className="form-input" value={goalForm.dueDate}
                                    onChange={(e) => setGoalForm({ ...goalForm, dueDate: e.target.value })} required />
                            </div>
                            {canManageEmployees && (
                                <div>
                                    <label className="form-label">Assign To (Optional)</label>
                                    <select className="form-input" value={goalForm.employeeId}
                                        onChange={(e) => setGoalForm({ ...goalForm, employeeId: e.target.value })}>
                                        <option value="">Self</option>
                                        {employees.map(emp => (
                                            <option key={emp._id} value={emp._id}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowGoalModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                                <button type="submit" className="btn btn-primary flex-1">Create Goal</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// ============ OKR CARD COMPONENT ============

const OKRCard = ({ okr, expanded, onToggle, onUpdateKR, onUpdateStatus, onDelete, getScoreColor, getScoreBg, getStatusBadge, getKRProgress, showOwner }) => {
    return (
        <div className="card hover:shadow-lg transition-all duration-300">
            <div className="flex items-start gap-4 cursor-pointer" onClick={onToggle}>
                {/* Score circle */}
                <div className="flex-shrink-0">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${getScoreBg(okr.score)} bg-opacity-10 border-2 border-opacity-30 ${getScoreBg(okr.score).replace('bg-', 'border-')}`}>
                        <span className={`text-lg font-bold ${getScoreColor(okr.score)}`}>
                            {(okr.score * 100).toFixed(0)}%
                        </span>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold text-gray-800 text-lg">{okr.title}</h3>
                        <span className={`badge ${getStatusBadge(okr.status)}`}>{okr.status}</span>
                        <span className="badge badge-neutral">{okr.cycle} {okr.year}</span>
                        <span className="text-xs text-gray-400 capitalize">{okr.category}</span>
                    </div>
                    {showOwner && okr.owner && (
                        <p className="text-sm text-gray-500 mb-1">{okr.owner.name} · {okr.owner.position}</p>
                    )}
                    {okr.description && (
                        <p className="text-gray-600 text-sm">{okr.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                        <span>{okr.keyResults?.length || 0} key results</span>
                        <span>·</span>
                        <span className={getScoreColor(okr.score)}>Score: {(okr.score * 100).toFixed(0)}%</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                    {okr.status === 'draft' && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onUpdateStatus(okr._id, 'active'); }}
                            className="text-xs btn btn-outline py-1 px-3"
                        >
                            Activate
                        </button>
                    )}
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(okr._id); }}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                    {expanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                </div>
            </div>

            {/* Expanded Key Results */}
            {expanded && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-3 animate-fade-in">
                    {okr.keyResults?.map((kr, idx) => {
                        const progress = getKRProgress(kr);
                        return (
                            <div key={kr._id || idx} className="p-4 bg-gray-50 rounded-xl">
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-400">KR {idx + 1}</span>
                                        <span className="font-medium text-gray-800">{kr.title}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <span className="text-gray-500">
                                            {kr.currentValue} / {kr.targetValue} {kr.unit}
                                        </span>
                                        <span className={`font-semibold ${progress >= 100 ? 'text-emerald-600' : progress >= 70 ? 'text-amber-600' : 'text-gray-600'}`}>
                                            {progress}%
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${progress >= 100 ? 'bg-emerald-500' : progress >= 70 ? 'bg-amber-500' : 'bg-primary-500'}`}
                                            style={{ width: `${progress}%` }}
                                        />
                                    </div>
                                    <input
                                        type="number"
                                        className="w-20 form-input py-1 px-2 text-sm text-center"
                                        value={kr.currentValue}
                                        onChange={(e) => onUpdateKR(okr._id, idx, e.target.value)}
                                        min="0"
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                </div>
                                {kr.weight !== 1 && (
                                    <span className="text-xs text-gray-400 mt-1 block">Weight: {kr.weight}x</span>
                                )}
                            </div>
                        );
                    })}

                    {/* Quick status actions */}
                    {okr.status === 'active' && (
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => onUpdateStatus(okr._id, 'completed')}
                                className="btn btn-primary py-1.5 text-sm flex items-center gap-1"
                            >
                                <CheckCircle className="w-3 h-3" /> Mark Complete
                            </button>
                            <button
                                onClick={() => onUpdateStatus(okr._id, 'cancelled')}
                                className="btn btn-ghost py-1.5 text-sm text-red-500"
                            >
                                Cancel OKR
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============ KPI CARD COMPONENT ============

const KPICard = ({ kpi, onAddEntry, onDelete, getTrendIcon, canManageEmployees }) => {
    const progress = kpi.targetValue > 0
        ? Math.min(Math.round((kpi.currentValue / kpi.targetValue) * 100), 100)
        : 0;

    const progressColor = progress >= 100 ? 'from-emerald-500 to-emerald-600'
        : progress >= 70 ? 'from-amber-500 to-amber-600'
            : 'from-primary-500 to-primary-600';

    return (
        <div className="card-hover p-6">
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-800 truncate">{kpi.name}</h3>
                    {kpi.employee && (
                        <p className="text-xs text-gray-500">{kpi.employee.name}</p>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    {getTrendIcon(kpi.trend)}
                    <span className="text-xs capitalize text-gray-500">{kpi.trend?.replace('-', ' ')}</span>
                </div>
            </div>

            {/* Value display */}
            <div className="flex items-end gap-1 mb-3">
                <span className="text-3xl font-bold text-gray-800">{kpi.currentValue || 0}</span>
                <span className="text-gray-500 text-sm mb-1">/ {kpi.targetValue} {kpi.unit}</span>
            </div>

            {/* Progress bar */}
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden mb-3">
                <div
                    className={`h-full bg-gradient-to-r ${progressColor} rounded-full transition-all duration-500`}
                    style={{ width: `${progress}%` }}
                />
            </div>

            {/* Meta info */}
            <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="badge badge-neutral capitalize">{kpi.category}</span>
                <span className="badge badge-neutral capitalize">{kpi.frequency}</span>
                {kpi.entries?.length > 0 && (
                    <span className="text-xs text-gray-400">{kpi.entries.length} entries</span>
                )}
            </div>

            {/* Mini sparkline (last 6 entries) */}
            {kpi.entries?.length > 1 && (
                <div className="flex items-end gap-1 h-10 mb-4">
                    {kpi.entries.slice(-6).map((entry, idx) => {
                        const max = Math.max(...kpi.entries.slice(-6).map(e => e.value), 1);
                        const height = (entry.value / max) * 100;
                        return (
                            <div key={idx} className="flex-1 flex flex-col justify-end" title={`${entry.value} ${kpi.unit} — ${new Date(entry.date).toLocaleDateString()}`}>
                                <div
                                    className="bg-primary-400 rounded-sm min-h-[2px] transition-all hover:bg-primary-600"
                                    style={{ height: `${height}%` }}
                                />
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
                <button onClick={onAddEntry} className="btn btn-outline py-1.5 text-sm flex-1 flex items-center justify-center gap-1">
                    <Plus className="w-3 h-3" /> Log Entry
                </button>
                {canManageEmployees && (
                    <button onClick={() => onDelete(kpi._id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};

export default OKR;
