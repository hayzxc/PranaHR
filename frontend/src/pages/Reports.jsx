import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { employeeAPI, leaveAPI, attendanceAPI, payrollAPI, performanceAPI } from '../services/api';
import {
    Users,
    UserCheck,
    UserX,
    Calendar,
    Clock,
    DollarSign,
    TrendingUp,
    TrendingDown,
    BarChart3,
    PieChart,
    Loader2,
    Download
} from 'lucide-react';

const Reports = () => {
    const { canManageEmployees } = useAuth();
    const [loading, setLoading] = useState(true);
    const [activeReport, setActiveReport] = useState('overview');
    const [stats, setStats] = useState({
        employees: null,
        leaves: null,
        attendance: null,
        payroll: null,
        performance: null
    });
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchAllStats();
    }, [dateRange]);

    const fetchAllStats = async () => {
        setLoading(true);
        try {
            const [empRes, leaveRes, payrollRes, perfRes] = await Promise.all([
                employeeAPI.getStats(),
                leaveAPI.getStats(),
                payrollAPI.getStats({ year: new Date().getFullYear() }),
                performanceAPI.getStats({ year: new Date().getFullYear() })
            ]);

            setStats({
                employees: empRes.data.data,
                leaves: leaveRes.data.data,
                payroll: payrollRes.data.data,
                performance: perfRes.data.data
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!canManageEmployees) {
        return (
            <div className="text-center py-12">
                <h2 className="text-xl text-gray-600">Access Denied</h2>
                <p className="text-gray-500">You don't have permission to view reports.</p>
            </div>
        );
    }

    const reports = [
        { id: 'overview', label: 'Overview', icon: BarChart3 },
        { id: 'employees', label: 'Employees', icon: Users },
        { id: 'attendance', label: 'Attendance', icon: Clock },
        { id: 'leaves', label: 'Time Off', icon: Calendar },
        { id: 'payroll', label: 'Payroll', icon: DollarSign },
        { id: 'performance', label: 'Performance', icon: TrendingUp },
    ];

    const StatCard = ({ title, value, change, icon: Icon, color = 'primary' }) => (
        <div className="card p-6">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm text-gray-500">{title}</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
                    {change && (
                        <div className={`flex items-center gap-1 mt-2 text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            {Math.abs(change)}% vs last month
                        </div>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-xl bg-${color}-100 flex items-center justify-center`}>
                    <Icon className={`w-6 h-6 text-${color}-600`} />
                </div>
            </div>
        </div>
    );

    const ProgressBar = ({ label, value, max, color = 'primary' }) => (
        <div className="space-y-1">
            <div className="flex justify-between text-sm">
                <span className="text-gray-600">{label}</span>
                <span className="font-medium">{value}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                    className={`h-full bg-${color}-500 rounded-full transition-all duration-500`}
                    style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
                />
            </div>
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Reports & Analytics</h1>
                    <p className="text-gray-500">View insights and analytics about your organization</p>
                </div>
                <button className="btn btn-secondary flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Export Report
                </button>
            </div>

            {/* Report Tabs */}
            <div className="border-b border-gray-200">
                <nav className="flex gap-4 overflow-x-auto">
                    {reports.map(report => (
                        <button
                            key={report.id}
                            onClick={() => setActiveReport(report.id)}
                            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${activeReport === report.id
                                ? 'border-primary-500 text-primary-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700'
                                }`}
                        >
                            <report.icon className="w-4 h-4" />
                            {report.label}
                        </button>
                    ))}
                </nav>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                </div>
            ) : (
                <>
                    {/* Overview */}
                    {activeReport === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <StatCard
                                    title="Total Employees"
                                    value={stats.employees?.totalEmployees || 0}
                                    icon={Users}
                                    color="primary"
                                />
                                <StatCard
                                    title="Active Employees"
                                    value={stats.employees?.activeEmployees || 0}
                                    icon={UserCheck}
                                    color="green"
                                />
                                <StatCard
                                    title="Pending Leaves"
                                    value={stats.leaves?.pending || 0}
                                    icon={Calendar}
                                    color="yellow"
                                />
                                <StatCard
                                    title="Payroll This Month"
                                    value={`Rp ${(stats.payroll?.currentMonth?.totalNet || 0).toLocaleString()}`}
                                    icon={DollarSign}
                                    color="blue"
                                />
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Department Distribution */}
                                <div className="card p-6">
                                    <h3 className="text-lg font-semibold mb-4">Employees by Department</h3>
                                    <div className="space-y-3">
                                        {stats.employees?.byDepartment?.map(dept => (
                                            <ProgressBar
                                                key={dept._id}
                                                label={dept._id}
                                                value={dept.count}
                                                max={stats.employees?.totalEmployees || 1}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Leave Status */}
                                <div className="card p-6">
                                    <h3 className="text-lg font-semibold mb-4">Leave Requests Status</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="text-center p-4 bg-yellow-50 rounded-xl">
                                            <p className="text-2xl font-bold text-yellow-600">{stats.leaves?.pending || 0}</p>
                                            <p className="text-sm text-gray-600">Pending</p>
                                        </div>
                                        <div className="text-center p-4 bg-green-50 rounded-xl">
                                            <p className="text-2xl font-bold text-green-600">{stats.leaves?.approved || 0}</p>
                                            <p className="text-sm text-gray-600">Approved</p>
                                        </div>
                                        <div className="text-center p-4 bg-red-50 rounded-xl">
                                            <p className="text-2xl font-bold text-red-600">{stats.leaves?.rejected || 0}</p>
                                            <p className="text-sm text-gray-600">Rejected</p>
                                        </div>
                                        <div className="text-center p-4 bg-gray-50 rounded-xl">
                                            <p className="text-2xl font-bold text-gray-600">{stats.leaves?.cancelled || 0}</p>
                                            <p className="text-sm text-gray-600">Cancelled</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Employees Report */}
                    {activeReport === 'employees' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <StatCard title="Total Employees" value={stats.employees?.totalEmployees || 0} icon={Users} />
                                <StatCard title="Active" value={stats.employees?.activeEmployees || 0} icon={UserCheck} color="green" />
                                <StatCard title="Inactive/Terminated" value={(stats.employees?.totalEmployees || 0) - (stats.employees?.activeEmployees || 0)} icon={UserX} color="red" />
                            </div>

                            <div className="card p-6">
                                <h3 className="text-lg font-semibold mb-4">Department Breakdown</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b">
                                                <th className="text-left py-3 px-4">Department</th>
                                                <th className="text-right py-3 px-4">Count</th>
                                                <th className="text-right py-3 px-4">Percentage</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stats.employees?.byDepartment?.map(dept => (
                                                <tr key={dept._id} className="border-b hover:bg-gray-50">
                                                    <td className="py-3 px-4">{dept._id}</td>
                                                    <td className="text-right py-3 px-4">{dept.count}</td>
                                                    <td className="text-right py-3 px-4">
                                                        {((dept.count / stats.employees.totalEmployees) * 100).toFixed(1)}%
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Payroll Report */}
                    {activeReport === 'payroll' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <StatCard
                                    title="Total Gross (This Month)"
                                    value={`Rp ${(stats.payroll?.currentMonth?.totalGross || 0).toLocaleString()}`}
                                    icon={DollarSign}
                                />
                                <StatCard
                                    title="Total Net (This Month)"
                                    value={`Rp ${(stats.payroll?.currentMonth?.totalNet || 0).toLocaleString()}`}
                                    icon={DollarSign}
                                    color="green"
                                />
                                <StatCard
                                    title="Employees Processed"
                                    value={stats.payroll?.currentMonth?.count || 0}
                                    icon={Users}
                                    color="blue"
                                />
                            </div>

                            <div className="card p-6">
                                <h3 className="text-lg font-semibold mb-4">Monthly Payroll Trend ({new Date().getFullYear()})</h3>
                                <div className="space-y-3">
                                    {stats.payroll?.monthly?.map(month => (
                                        <div key={month._id} className="flex items-center gap-4">
                                            <span className="w-12 text-sm text-gray-500">
                                                {new Date(2024, month._id - 1).toLocaleString('default', { month: 'short' })}
                                            </span>
                                            <div className="flex-1 h-8 bg-gray-100 rounded-lg overflow-hidden relative">
                                                <div
                                                    className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg"
                                                    style={{
                                                        width: `${Math.min((month.totalNet / (stats.payroll?.monthly?.[0]?.totalNet || 1)) * 100, 100)}%`
                                                    }}
                                                />
                                                <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
                                                    Rp {month.totalNet.toLocaleString()}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Performance Report */}
                    {activeReport === 'performance' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="card p-6">
                                    <h3 className="text-lg font-semibold mb-4">Review Status</h3>
                                    <div className="space-y-3">
                                        {stats.performance?.reviews?.map(item => (
                                            <div key={item._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <span className="capitalize">{item._id}</span>
                                                <span className="font-semibold">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="card p-6">
                                    <h3 className="text-lg font-semibold mb-4">Goals Status</h3>
                                    <div className="space-y-3">
                                        {stats.performance?.goals?.map(item => (
                                            <div key={item._id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                                <span className="capitalize">{item._id.replace('-', ' ')}</span>
                                                <span className="font-semibold">{item.count}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Placeholder for other reports */}
                    {(activeReport === 'attendance' || activeReport === 'leaves') && (
                        <div className="card p-12 text-center">
                            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-600">
                                {activeReport.charAt(0).toUpperCase() + activeReport.slice(1)} Report
                            </h3>
                            <p className="text-gray-500">Detailed analytics coming soon</p>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default Reports;
