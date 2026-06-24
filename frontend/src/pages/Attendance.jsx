import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { attendanceAPI } from '../services/api';
import {
    Clock,
    Calendar,
    Play,
    Square,
    CheckCircle,
    XCircle,
    AlertCircle
} from 'lucide-react';

const Attendance = () => {
    const { employee, canManageEmployees } = useAuth();
    const { showToast } = useToast();
    const [attendance, setAttendance] = useState([]);
    const [todayAttendance, setTodayAttendance] = useState(null);
    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(true);
    const [clockingIn, setClockingIn] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [dateRange, setDateRange] = useState({
        startDate: new Date(new Date().setDate(1)).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchData = async () => {
        try {
            const [attendanceRes, todayRes] = await Promise.all([
                attendanceAPI.getAll({
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate,
                    limit: 50
                }),
                attendanceAPI.getToday()
            ]);

            setAttendance(attendanceRes.data.data || []);
            setTodayAttendance(todayRes.data.data);

            if (canManageEmployees) {
                const summaryRes = await attendanceAPI.getSummary({
                    startDate: dateRange.startDate,
                    endDate: dateRange.endDate
                });
                setSummary(summaryRes.data.data);
            }
        } catch (error) {
            console.error('Error fetching attendance:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClockIn = async () => {
        setClockingIn(true);
        try {
            await attendanceAPI.clockIn({});
            fetchData();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to clock in', 'error');
        }
        setClockingIn(false);
    };

    const handleClockOut = async () => {
        setClockingIn(true);
        try {
            await attendanceAPI.clockOut({});
            fetchData();
        } catch (error) {
            showToast(error.response?.data?.message || 'Failed to clock out', 'error');
        }
        setClockingIn(false);
    };

    const formatTime = (date) => date ? new Date(date).toLocaleTimeString() : '-';
    const formatDate = (date) => new Date(date).toLocaleDateString();

    const getStatusIcon = (status) => {
        switch (status) {
            case 'present': return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'late': return <AlertCircle className="w-5 h-5 text-yellow-500" />;
            case 'absent': return <XCircle className="w-5 h-5 text-red-500" />;
            default: return <Clock className="w-5 h-5 text-gray-400" />;
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'present': return 'badge-success';
            case 'late': return 'badge-warning';
            case 'absent': return 'badge-danger';
            default: return 'badge-info';
        }
    };

    const isClockedIn = todayAttendance?.isClockedIn;

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Attendance Tracker</h1>
                    <p className="text-gray-500">Track your work hours and attendance</p>
                </div>
            </div>

            {/* Clock In/Out Card */}
            <div className="card gradient-primary text-white">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div>
                        <h2 className="text-xl font-semibold mb-2">Today's Attendance</h2>
                        <p className="text-white/80">
                            {new Date().toLocaleDateString('en-US', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                            })}
                        </p>

                        {todayAttendance?.attendance && (
                            <div className="mt-4 grid grid-cols-3 gap-4">
                                <div>
                                    <p className="text-white/70 text-sm">Clock In</p>
                                    <p className="font-semibold text-lg">
                                        {formatTime(todayAttendance.attendance.clockIn)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-white/70 text-sm">Clock Out</p>
                                    <p className="font-semibold text-lg">
                                        {formatTime(todayAttendance.attendance.clockOut)}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-white/70 text-sm">Hours</p>
                                    <p className="font-semibold text-lg">
                                        {todayAttendance.attendance.hoursWorked?.toFixed(2) || 0}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-center gap-4">
                        <div className="text-6xl font-bold">
                            {currentTime.toLocaleTimeString('en-US', {
                                hour: '2-digit',
                                minute: '2-digit'
                            })}
                        </div>
                        <button
                            onClick={isClockedIn ? handleClockOut : handleClockIn}
                            disabled={clockingIn}
                            className={`flex items-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all ${isClockedIn
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-white text-primary-600 hover:bg-gray-50'
                                }`}
                        >
                            {clockingIn ? (
                                <div className="w-6 h-6 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                            ) : isClockedIn ? (
                                <>
                                    <Square className="w-6 h-6" />
                                    Clock Out
                                </>
                            ) : (
                                <>
                                    <Play className="w-6 h-6" />
                                    Clock In
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Stats - HR/Admin */}
            {canManageEmployees && summary && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    {summary.summary?.map((stat, index) => (
                        <div key={stat._id} className="stat-card">
                            {getStatusIcon(stat._id)}
                            <div>
                                <p className="text-gray-500 text-sm capitalize">{stat._id || 'Pending'}</p>
                                <p className="text-2xl font-bold text-gray-800">{stat.count}</p>
                                <p className="text-xs text-gray-400">
                                    Avg: {stat.avgHours?.toFixed(1) || 0} hrs
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Date Filter */}
            <div className="card">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    <Calendar className="w-5 h-5 text-gray-400" />
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            className="input w-40"
                            value={dateRange.startDate}
                            onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                        />
                        <span className="text-gray-400">to</span>
                        <input
                            type="date"
                            className="input w-40"
                            value={dateRange.endDate}
                            onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* Attendance History */}
            <div className="card overflow-hidden p-0">
                <div className="p-6 border-b">
                    <h2 className="text-lg font-semibold text-gray-800">Attendance History</h2>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-64">
                        <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
                    </div>
                ) : attendance.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                        <Clock className="w-12 h-12 mb-2 text-gray-300" />
                        <p>No attendance records found</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="table-header">Date</th>
                                    {canManageEmployees && <th className="table-header">Employee</th>}
                                    <th className="table-header">Clock In</th>
                                    <th className="table-header">Clock Out</th>
                                    <th className="table-header">Hours</th>
                                    <th className="table-header">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {attendance.map((record) => (
                                    <tr key={record._id} className="border-b hover:bg-gray-50 transition-colors">
                                        <td className="table-cell font-medium">{formatDate(record.date)}</td>
                                        {canManageEmployees && (
                                            <td className="table-cell">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                                                        <span className="text-primary-600 font-semibold text-sm">
                                                            {record.employeeId?.name?.[0]?.toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <span>{record.employeeId?.name}</span>
                                                </div>
                                            </td>
                                        )}
                                        <td className="table-cell">{formatTime(record.clockIn)}</td>
                                        <td className="table-cell">{formatTime(record.clockOut)}</td>
                                        <td className="table-cell font-medium">
                                            {record.hoursWorked?.toFixed(2) || '-'} hrs
                                        </td>
                                        <td className="table-cell">
                                            <span className={`badge ${getStatusBadge(record.status)}`}>
                                                {record.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Attendance;
