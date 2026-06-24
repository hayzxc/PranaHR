import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { payrollAPI, employeeAPI } from '../services/api';
import {
    DollarSign,
    Users,
    Calendar,
    Download,
    Plus,
    Search,
    Filter,
    Check,
    X,
    Loader2,
    FileText,
    CreditCard,
    TrendingUp,
    Pencil
} from 'lucide-react';

const Payroll = () => {
    const { canManageEmployees, isAdmin } = useAuth();
    const { showToast } = useToast();
    const [payrolls, setPayrolls] = useState([]);
    const [employees, setEmployees] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [selectedPayroll, setSelectedPayroll] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editForm, setEditForm] = useState(null);
    const [editLoading, setEditLoading] = useState(false);
    const [filters, setFilters] = useState({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        status: ''
    });
    const [stats, setStats] = useState(null);

    useEffect(() => {
        fetchData();
    }, [filters]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [payrollRes, statsRes] = await Promise.all([
                payrollAPI.getAll(filters),
                payrollAPI.getStats({ year: filters.year })
            ]);

            setPayrolls(payrollRes.data.data || []);
            setStats(statsRes.data.data);

            if (canManageEmployees) {
                const empRes = await employeeAPI.getAll({ limit: 100, status: 'active' });
                setEmployees(empRes.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching payroll data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateBatch = async () => {
        if (!confirm(`Generate payroll for all active employees for ${filters.month}/${filters.year}?`)) return;
        try {
            const { data } = await payrollAPI.generateBatch({
                month: filters.month,
                year: filters.year
            });
            showToast(data.message, 'success');
            setShowGenerateModal(false);
            fetchData();
        } catch (error) {
            console.error('Error generating payroll:', error);
            showToast(error.response?.data?.message || 'Error generating payroll', 'error');
        }
    };

    const handleApprove = async (id) => {
        try {
            await payrollAPI.approve(id);
            fetchData();
        } catch (error) {
            console.error('Error approving payroll:', error);
        }
    };

    const handleMarkPaid = async (id) => {
        try {
            await payrollAPI.pay(id);
            fetchData();
        } catch (error) {
            console.error('Error marking as paid:', error);
            showToast(error.response?.data?.message || 'Error marking as paid', 'error');
        }
    };

    const openEditModal = (payroll) => {
        setEditForm({
            _id: payroll._id,
            basicSalary: payroll.basicSalary || 0,
            earnings: {
                overtime: payroll.earnings?.overtime || 0,
                bonus: payroll.earnings?.bonus || 0,
                allowances: payroll.earnings?.allowances || 0,
                transport: payroll.earnings?.transport || 0,
                meal: payroll.earnings?.meal || 0,
                other: payroll.earnings?.other || 0,
            },
            deductions: {
                tax: payroll.deductions?.tax || 0,
                bpjs: payroll.deductions?.bpjs || payroll.deductions?.insurance || 0,
                pension: payroll.deductions?.pension || 0,
                loan: payroll.deductions?.loan || 0,
                absence: payroll.deductions?.absence || 0,
                other: payroll.deductions?.other || 0,
            },
            workingDays: {
                expected: payroll.workingDays?.expected || 22,
                actual: payroll.workingDays?.actual || 22,
            },
            overtimeHours: payroll.overtimeHours || 0,
            paymentMethod: payroll.paymentMethod || 'bank_transfer',
            notes: payroll.notes || '',
            employeeName: payroll.employee?.name || 'Unknown',
        });
        setShowEditModal(true);
    };

    const handleEditSave = async (e) => {
        e.preventDefault();
        setEditLoading(true);
        try {
            const { _id, employeeName, ...updateData } = editForm;
            await payrollAPI.update(_id, updateData);
            setShowEditModal(false);
            setEditForm(null);
            if (selectedPayroll?._id === _id) {
                const { data } = await payrollAPI.getById(_id);
                setSelectedPayroll(data.data);
            }
            fetchData();
        } catch (error) {
            console.error('Error updating payroll:', error);
            showToast(error.response?.data?.message || 'Error updating payroll', 'error');
        } finally {
            setEditLoading(false);
        }
    };

    const updateEarnings = (field, value) => {
        setEditForm(prev => ({
            ...prev,
            earnings: { ...prev.earnings, [field]: parseFloat(value) || 0 }
        }));
    };

    const updateDeductions = (field, value) => {
        setEditForm(prev => ({
            ...prev,
            deductions: { ...prev.deductions, [field]: parseFloat(value) || 0 }
        }));
    };

    const getStatusBadge = (status) => {
        const styles = {
            draft: 'bg-gray-100 text-gray-600',
            pending: 'bg-yellow-100 text-yellow-600',
            approved: 'bg-blue-100 text-blue-600',
            paid: 'bg-green-100 text-green-600',
            cancelled: 'bg-red-100 text-red-600'
        };
        return styles[status] || styles.draft;
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    };

    const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const handleExportCSV = async () => {
        try {
            const response = await payrollAPI.exportCSV(filters);
            const blob = new Blob([response.data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payroll_${months[filters.month - 1]}_${filters.year}.csv`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error exporting CSV:', error);
            showToast('Error exporting payroll data', 'error');
        }
    };

    if (!canManageEmployees) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl text-gray-600">Access Denied</h2>
                <p className="text-gray-500">You don't have permission to access payroll.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Payroll</h1>
                    <p className="text-gray-500">Manage employee salaries and payslips</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleExportCSV}
                        className="btn btn-outline flex items-center gap-2"
                        disabled={payrolls.length === 0}
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                    <button
                        onClick={() => setShowGenerateModal(true)}
                        className="btn btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Generate Payroll
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Total Gross</p>
                            <p className="text-xl font-bold text-gray-800">
                                {formatCurrency(stats?.currentMonth?.totalGross || 0)}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-blue-600" />
                        </div>
                    </div>
                </div>
                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Total Net</p>
                            <p className="text-xl font-bold text-gray-800">
                                {formatCurrency(stats?.currentMonth?.totalNet || 0)}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-green-600" />
                        </div>
                    </div>
                </div>
                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Employees Processed</p>
                            <p className="text-xl font-bold text-gray-800">{stats?.currentMonth?.count || 0}</p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-600" />
                        </div>
                    </div>
                </div>
                <div className="card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-500">Pending Approval</p>
                            <p className="text-xl font-bold text-gray-800">
                                {stats?.statusCounts?.find(s => s._id === 'pending')?.count || 0}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-yellow-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="card p-4">
                <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <select
                            className="form-input py-2"
                            value={filters.month}
                            onChange={(e) => setFilters({ ...filters, month: parseInt(e.target.value) })}
                        >
                            {months.map((month, idx) => (
                                <option key={idx} value={idx + 1}>{month}</option>
                            ))}
                        </select>
                        <select
                            className="form-input py-2"
                            value={filters.year}
                            onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
                        >
                            {[2024, 2025, 2026].map(year => (
                                <option key={year} value={year}>{year}</option>
                            ))}
                        </select>
                    </div>
                    <select
                        className="form-input py-2"
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    >
                        <option value="">All Status</option>
                        <option value="draft">Draft</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="paid">Paid</option>
                    </select>
                </div>
            </div>

            {/* Payroll Table */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
            ) : payrolls.length === 0 ? (
                <div className="card p-12 text-center">
                    <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-600">No payroll records</h3>
                    <p className="text-gray-500 mb-4">Generate payroll for this period</p>
                    <button
                        onClick={() => setShowGenerateModal(true)}
                        className="btn btn-primary"
                    >
                        Generate Payroll
                    </button>
                </div>
            ) : (
                <div className="card p-0 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Employee
                                    </th>
                                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Period
                                    </th>
                                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Basic Salary
                                    </th>
                                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Earnings
                                    </th>
                                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Deductions
                                    </th>
                                    <th className="px-4 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Net Pay
                                    </th>
                                    <th className="px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-4 py-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {payrolls.map((payroll, index) => (
                                    <tr
                                        key={payroll._id}
                                        className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-semibold text-sm">
                                                    {payroll.employee?.name?.charAt(0) || '?'}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-gray-900">{payroll.employee?.name || 'Unknown'}</p>
                                                    <p className="text-sm text-gray-500">{payroll.employee?.employeeId} • {payroll.employee?.department}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-gray-400" />
                                                <span className="text-gray-700 font-medium">
                                                    {months[payroll.period.month - 1]} {payroll.period.year}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <span className="text-gray-900 font-medium">
                                                {formatCurrency(payroll.basicSalary)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <span className="text-green-600 font-medium">
                                                +{formatCurrency(payroll.grossPay - payroll.basicSalary)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <span className="text-red-600 font-medium">
                                                -{formatCurrency(payroll.totalDeductions)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <span className="text-gray-900 font-bold text-base">
                                                {formatCurrency(payroll.netPay)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold capitalize ${getStatusBadge(payroll.status)}`}>
                                                {payroll.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="flex items-center justify-center gap-1">
                                                {(payroll.status === 'draft' || payroll.status === 'pending') && (
                                                    <button
                                                        onClick={() => openEditModal(payroll)}
                                                        className="p-2 text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
                                                        title="Edit Payroll"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {payroll.status === 'draft' && isAdmin && (
                                                    <button
                                                        onClick={() => handleApprove(payroll._id)}
                                                        className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
                                                        title="Approve"
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                )}
                                                {payroll.status === 'approved' && isAdmin && (
                                                    <button
                                                        onClick={() => handleMarkPaid(payroll._id)}
                                                        className="p-2 text-green-600 hover:bg-green-100 rounded-lg transition-colors"
                                                        title="Mark as Paid"
                                                    >
                                                        <CreditCard className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => setSelectedPayroll(payroll)}
                                                    className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <FileText className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        try {
                                                            const response = await payrollAPI.downloadSlip(payroll._id);
                                                            const blob = new Blob([response.data], { type: 'application/pdf' });
                                                            const url = window.URL.createObjectURL(blob);
                                                            const link = document.createElement('a');
                                                            link.href = url;
                                                            link.setAttribute('download', `Payslip_${payroll.employee?.name || 'Employee'}.pdf`);
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            link.remove();
                                                        } catch (error) {
                                                            console.error('Download failed', error);
                                                            showToast('Failed to download payslip', 'error');
                                                        }
                                                    }}
                                                    className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                                                    title="Download PDF"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Table Footer Summary */}
                    <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <p className="text-sm text-gray-600">
                                Showing <span className="font-semibold">{payrolls.length}</span> payroll records for {months[filters.month - 1]} {filters.year}
                            </p>
                            <div className="flex items-center gap-6 text-sm">
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500">Total Gross:</span>
                                    <span className="font-semibold text-gray-900">
                                        {formatCurrency(payrolls.reduce((sum, p) => sum + (p.grossPay || 0), 0))}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-gray-500">Total Net:</span>
                                    <span className="font-bold text-primary-600">
                                        {formatCurrency(payrolls.reduce((sum, p) => sum + (p.netPay || 0), 0))}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Generate Modal */}
            {
                showGenerateModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl w-full max-w-md animate-fade-in">
                            <div className="p-6 border-b">
                                <h2 className="text-xl font-bold">Generate Payroll</h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <p className="text-gray-600">
                                    This will generate payroll records for all active employees for{' '}
                                    <strong>{months[filters.month - 1]} {filters.year}</strong>.
                                </p>
                                <p className="text-sm text-gray-500">
                                    Existing records for this period will be skipped.
                                </p>
                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => setShowGenerateModal(false)}
                                        className="btn btn-secondary flex-1"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleGenerateBatch}
                                        className="btn btn-primary flex-1"
                                    >
                                        Generate
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Payslip Detail Modal */}
            {
                selectedPayroll && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
                            <div className="p-6 border-b flex items-center justify-between">
                                <h2 className="text-xl font-bold">Payslip Details</h2>
                                <button
                                    onClick={() => setSelectedPayroll(null)}
                                    className="p-2 hover:bg-gray-100 rounded-lg"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="p-6 space-y-6">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h3 className="text-lg font-semibold">{selectedPayroll.employee?.name}</h3>
                                        <p className="text-gray-500">{selectedPayroll.employee?.employeeId}</p>
                                        <p className="text-gray-500">{selectedPayroll.employee?.department}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium">{months[selectedPayroll.period.month - 1]} {selectedPayroll.period.year}</p>
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(selectedPayroll.status)}`}>
                                            {selectedPayroll.status}
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-6">
                                    <div>
                                        <h4 className="font-medium mb-3 text-green-600">Earnings</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between">
                                                <span>Basic Salary</span>
                                                <span>{formatCurrency(selectedPayroll.basicSalary)}</span>
                                            </div>
                                            {Object.entries(selectedPayroll.earnings || {}).map(([key, value]) => (
                                                value > 0 && (
                                                    <div key={key} className="flex justify-between text-sm">
                                                        <span className="capitalize">{key}</span>
                                                        <span>{formatCurrency(value)}</span>
                                                    </div>
                                                )
                                            ))}
                                            <div className="flex justify-between font-semibold pt-2 border-t">
                                                <span>Gross Pay</span>
                                                <span>{formatCurrency(selectedPayroll.grossPay)}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <h4 className="font-medium mb-3 text-red-600">Deductions</h4>
                                        <div className="space-y-2">
                                            {Object.entries(selectedPayroll.deductions || {}).map(([key, value]) => (
                                                value > 0 && (
                                                    <div key={key} className="flex justify-between text-sm">
                                                        <span className="capitalize">{key === 'bpjs' ? 'BPJS' : key}</span>
                                                        <span>{formatCurrency(value)}</span>
                                                    </div>
                                                )
                                            ))}
                                            <div className="flex justify-between font-semibold pt-2 border-t">
                                                <span>Total Deductions</span>
                                                <span>{formatCurrency(selectedPayroll.totalDeductions)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-primary-50 rounded-xl p-4">
                                    <div className="flex justify-between items-center">
                                        <span className="text-lg font-semibold">Net Pay</span>
                                        <span className="text-2xl font-bold text-primary-600">
                                            {formatCurrency(selectedPayroll.netPay)}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    {(selectedPayroll.status === 'draft' || selectedPayroll.status === 'pending') && (
                                        <button
                                            onClick={() => {
                                                openEditModal(selectedPayroll);
                                                setSelectedPayroll(null);
                                            }}
                                            className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                                        >
                                            <Pencil className="w-4 h-4" />
                                            Edit Payroll
                                        </button>
                                    )}
                                    <button
                                        onClick={async () => {
                                            try {
                                                const response = await payrollAPI.downloadSlip(selectedPayroll._id);
                                                const blob = new Blob([response.data], { type: 'application/pdf' });
                                                const url = window.URL.createObjectURL(blob);
                                                const link = document.createElement('a');
                                                link.href = url;
                                                link.setAttribute('download', `Payslip_${selectedPayroll.employee.name}_${selectedPayroll.period.month}_${selectedPayroll.period.year}.pdf`);
                                                document.body.appendChild(link);
                                                link.click();
                                                link.remove();
                                            } catch (error) {
                                                console.error('Download failed', error);
                                                showToast('Failed to download payslip', 'error');
                                            }
                                        }}
                                        className="btn btn-secondary flex-1 flex items-center justify-center gap-2">
                                        <Download className="w-4 h-4" />
                                        Download PDF
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Edit Payroll Modal */}
            {showEditModal && editForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto animate-fade-in">
                        <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
                            <div>
                                <h2 className="text-xl font-bold">Edit Payroll</h2>
                                <p className="text-gray-500">{editForm.employeeName}</p>
                            </div>
                            <button
                                onClick={() => { setShowEditModal(false); setEditForm(null); }}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleEditSave} className="p-6 space-y-6">
                            {/* Basic Salary */}
                            <div>
                                <label className="form-label text-base font-semibold">Basic Salary</label>
                                <input
                                    type="number"
                                    className="form-input text-lg font-medium"
                                    value={editForm.basicSalary}
                                    onChange={(e) => setEditForm({ ...editForm, basicSalary: parseFloat(e.target.value) || 0 })}
                                    min="0"
                                />
                            </div>

                            {/* Earnings */}
                            <div>
                                <h3 className="text-base font-semibold text-green-600 mb-3 flex items-center gap-2">
                                    <TrendingUp className="w-4 h-4" />
                                    Earnings
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {Object.entries(editForm.earnings).map(([key, value]) => (
                                        <div key={key}>
                                            <label className="form-label capitalize">{key}</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={value}
                                                onChange={(e) => updateEarnings(key, e.target.value)}
                                                min="0"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Deductions */}
                            <div>
                                <h3 className="text-base font-semibold text-red-600 mb-3 flex items-center gap-2">
                                    <DollarSign className="w-4 h-4" />
                                    Deductions
                                </h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                    {Object.entries(editForm.deductions).map(([key, value]) => (
                                        <div key={key}>
                                            <label className="form-label uppercase">{key === 'bpjs' ? 'BPJS' : key}</label>
                                            <input
                                                type="number"
                                                className="form-input"
                                                value={value}
                                                onChange={(e) => updateDeductions(key, e.target.value)}
                                                min="0"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Working Days & Overtime */}
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="form-label">Expected Working Days</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={editForm.workingDays.expected}
                                        onChange={(e) => setEditForm({ ...editForm, workingDays: { ...editForm.workingDays, expected: parseInt(e.target.value) || 0 } })}
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Actual Working Days</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={editForm.workingDays.actual}
                                        onChange={(e) => setEditForm({ ...editForm, workingDays: { ...editForm.workingDays, actual: parseInt(e.target.value) || 0 } })}
                                        min="0"
                                    />
                                </div>
                                <div>
                                    <label className="form-label">Overtime Hours</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        value={editForm.overtimeHours}
                                        onChange={(e) => setEditForm({ ...editForm, overtimeHours: parseFloat(e.target.value) || 0 })}
                                        min="0"
                                    />
                                </div>
                            </div>

                            {/* Payment Method */}
                            <div>
                                <label className="form-label">Payment Method</label>
                                <select
                                    className="form-input"
                                    value={editForm.paymentMethod}
                                    onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
                                >
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="cash">Cash</option>
                                    <option value="check">Check</option>
                                </select>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="form-label">Notes</label>
                                <textarea
                                    className="form-input"
                                    rows="3"
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                    placeholder="Add any notes..."
                                />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t">
                                <button
                                    type="button"
                                    onClick={() => { setShowEditModal(false); setEditForm(null); }}
                                    className="btn btn-secondary flex-1"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                                    disabled={editLoading}
                                >
                                    {editLoading ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div >
    );
};

export default Payroll;
