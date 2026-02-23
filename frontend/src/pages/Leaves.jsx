import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { leaveAPI } from '../services/api';
import {
    Calendar,
    Plus,
    Check,
    X,
    Clock,
    Filter
} from 'lucide-react';

const Leaves = () => {
    const { canManageEmployees } = useAuth();
    const [leaves, setLeaves] = useState([]);
    const [pendingLeaves, setPendingLeaves] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [statusFilter, setStatusFilter] = useState('');
    const [formData, setFormData] = useState({
        type: 'annual',
        startDate: '',
        endDate: '',
        reason: ''
    });

    const leaveTypes = ['annual', 'sick', 'personal', 'maternity', 'paternity', 'unpaid', 'other'];

    useEffect(() => {
        fetchLeaves();
        if (canManageEmployees) {
            fetchPendingLeaves();
        }
    }, [statusFilter]);

    const fetchLeaves = async () => {
        try {
            const params = {};
            if (statusFilter) params.status = statusFilter;

            const response = await leaveAPI.getAll(params);
            setLeaves(response.data.data);
        } catch (error) {
            console.error('Error fetching leaves:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPendingLeaves = async () => {
        try {
            const response = await leaveAPI.getPending();
            setPendingLeaves(response.data.data);
        } catch (error) {
            console.error('Error fetching pending leaves:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await leaveAPI.create(formData);
            setShowModal(false);
            setFormData({ type: 'annual', startDate: '', endDate: '', reason: '' });
            fetchLeaves();
        } catch (error) {
            alert(error.response?.data?.message || 'Error submitting leave request');
        }
    };

    const handleApprove = async (id) => {
        try {
            await leaveAPI.approve(id);
            fetchLeaves();
            fetchPendingLeaves();
        } catch (error) {
            alert(error.response?.data?.message || 'Error approving leave');
        }
    };

    const handleReject = async (id) => {
        const reason = prompt('Rejection reason (optional):');
        try {
            await leaveAPI.reject(id, reason);
            fetchLeaves();
            fetchPendingLeaves();
        } catch (error) {
            alert(error.response?.data?.message || 'Error rejecting leave');
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'approved': return 'badge-success';
            case 'rejected': return 'badge-danger';
            case 'cancelled': return 'badge-warning';
            default: return 'badge-info';
        }
    };

    const formatDate = (date) => new Date(date).toLocaleDateString();

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Leave Management</h1>
                    <p className="text-gray-500">
                        {canManageEmployees ? 'Manage employee leave requests' : 'View and request leaves'}
                    </p>
                </div>
                <button onClick={() => setShowModal(true)} className="btn btn-primary flex items-center gap-2">
                    <Plus className="w-5 h-5" />
                    Request Leave
                </button>
            </div>

            {/* Pending Approvals - HR/Admin */}
            {canManageEmployees && pendingLeaves.length > 0 && (
                <div className="card border-l-4 border-yellow-500">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                        <Clock className="w-5 h-5 text-yellow-500" />
                        Pending Approvals ({pendingLeaves.length})
                    </h2>
                    <div className="space-y-3">
                        {pendingLeaves.slice(0, 5).map((leave) => (
                            <div key={leave._id} className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-yellow-200 flex items-center justify-center">
                                        <span className="text-yellow-700 font-semibold">
                                            {leave.employeeId?.name?.[0]?.toUpperCase()}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="font-medium text-gray-800">{leave.employeeId?.name}</p>
                                        <p className="text-sm text-gray-500">
                                            {leave.type} • {formatDate(leave.startDate)} - {formatDate(leave.endDate)} ({leave.totalDays} days)
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleApprove(leave._id)}
                                        className="p-2 bg-green-100 text-green-600 hover:bg-green-200 rounded-lg transition-colors"
                                    >
                                        <Check className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => handleReject(leave._id)}
                                        className="p-2 bg-red-100 text-red-600 hover:bg-red-200 rounded-lg transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Filter */}
            <div className="card">
                <div className="flex items-center gap-4">
                    <Filter className="w-5 h-5 text-gray-400" />
                    <select
                        className="input w-48"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                    >
                        <option value="">All Status</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                        <option value="cancelled">Cancelled</option>
                    </select>
                </div>
            </div>

            {/* Leave List */}
            <div className="card overflow-hidden p-0">
                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                    </div>
                ) : leaves.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <Calendar className="w-12 h-12 mb-2 text-gray-300" />
                        <p>No leave requests found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    {canManageEmployees && <th className="table-header">Employee</th>}
                                    <th className="table-header">Type</th>
                                    <th className="table-header">Duration</th>
                                    <th className="table-header">Days</th>
                                    <th className="table-header">Reason</th>
                                    <th className="table-header">Status</th>
                                    {canManageEmployees && <th className="table-header">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {leaves.map((leave) => (
                                    <tr key={leave._id} className="border-b hover:bg-gray-50 transition-colors">
                                        {canManageEmployees && (
                                            <td className="table-cell">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                                                        <span className="text-primary-600 font-semibold text-sm">
                                                            {leave.employeeId?.name?.[0]?.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span>{leave.employeeId?.name}</span>
                                                </div>
                                            </td>
                                        )}
                                        <td className="table-cell capitalize">{leave.type}</td>
                                        <td className="table-cell">
                                            {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                                        </td>
                                        <td className="table-cell">{leave.totalDays}</td>
                                        <td className="table-cell max-w-xs truncate">{leave.reason}</td>
                                        <td className="table-cell">
                                            <span className={`badge ${getStatusBadge(leave.status)}`}>
                                                {leave.status}
                                            </span>
                                        </td>
                                        {canManageEmployees && (
                                            <td className="table-cell">
                                                {leave.status === 'pending' && (
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleApprove(leave._id)}
                                                            className="p-1.5 text-green-600 hover:bg-green-50 rounded"
                                                        >
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleReject(leave._id)}
                                                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Request Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md animate-fade-in">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h2 className="text-xl font-bold text-gray-800">Request Leave</h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="label">Leave Type</label>
                                <select
                                    className="input"
                                    value={formData.type}
                                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                                >
                                    {leaveTypes.map(type => (
                                        <option key={type} value={type} className="capitalize">{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="label">Start Date</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={formData.startDate}
                                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="label">End Date</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={formData.endDate}
                                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="label">Reason</label>
                                <textarea
                                    className="input min-h-[100px] resize-none"
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    placeholder="Please provide a reason for your leave request..."
                                    required
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setShowModal(false)} className="btn btn-outline flex-1">
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary flex-1">
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Leaves;
