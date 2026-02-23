import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import DashboardGrid from '../components/DashboardGrid';
import { employeeAPI, leaveAPI, attendanceAPI, announcementAPI } from '../services/api';
import {
    Users,
    Calendar,
    Clock,
    TrendingUp,
    CheckCircle,
    XCircle,
    AlertCircle,
    Play,
    Square,
    Briefcase,
    MapPin,
    Building2,
    Megaphone,
    Pin,
    AlertTriangle,
    PartyPopper,
    Info
} from 'lucide-react';

// Animated Counter Component
const AnimatedCounter = ({ value, duration = 1000 }) => {
    const [count, setCount] = useState(0);
    const countRef = useRef(null);

    useEffect(() => {
        const target = parseInt(value) || 0;
        const startTime = Date.now();
        const startValue = 0;

        const updateCount = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function for smooth animation
            const easeOutQuart = 1 - Math.pow(1 - progress, 4);
            const currentValue = Math.floor(startValue + (target - startValue) * easeOutQuart);

            setCount(currentValue);

            if (progress < 1) {
                countRef.current = requestAnimationFrame(updateCount);
            }
        };

        countRef.current = requestAnimationFrame(updateCount);

        return () => {
            if (countRef.current) {
                cancelAnimationFrame(countRef.current);
            }
        };
    }, [value, duration]);

    return <span>{count}</span>;
};

// Skeleton Loader Component
const Skeleton = ({ className }) => (
    <div className={`animate-pulse bg-surface-200 rounded-lg ${className}`}></div>
);

// Skeleton Card Component
const SkeletonCard = () => (
    <div className="card">
        <div className="flex items-start justify-between mb-3">
            <Skeleton className="w-14 h-14 rounded-2xl" />
            <Skeleton className="w-4 h-4" />
        </div>
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-4 w-24" />
    </div>
);

// Skeleton Profile Card
const SkeletonProfile = () => (
    <div className="card">
        <div className="flex items-center gap-4 mb-6">
            <Skeleton className="w-16 h-16 rounded-2xl" />
            <div>
                <Skeleton className="h-6 w-32 mb-2" />
                <Skeleton className="h-4 w-24" />
            </div>
        </div>
        <div className="space-y-4">
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-4 p-3 bg-surface-50 rounded-xl">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <div className="flex-1">
                        <Skeleton className="h-3 w-16 mb-1" />
                        <Skeleton className="h-5 w-24" />
                    </div>
                </div>
            ))}
        </div>
    </div>
);

const Dashboard = () => {
    const { user, employee, canManageEmployees } = useAuth();
    const [stats, setStats] = useState(null);
    const [leaveStats, setLeaveStats] = useState(null);
    const [todayAttendance, setTodayAttendance] = useState(null);
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [clockingIn, setClockingIn] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        fetchData();
        // Update time every second
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchData = async () => {
        try {
            const [attendanceRes] = await Promise.all([
                attendanceAPI.getToday(),
                canManageEmployees ? employeeAPI.getStats().catch(() => null) : null,
                canManageEmployees ? leaveAPI.getStats().catch(() => null) : null,
            ]);

            setTodayAttendance(attendanceRes.data.data);

            if (canManageEmployees) {
                const [_, empStats, lvStats] = await Promise.all([
                    Promise.resolve(),
                    employeeAPI.getStats(),
                    leaveAPI.getStats(),
                ]);
                setStats(empStats.data.data);
                setLeaveStats(lvStats.data.data);
            }

            // Fetch announcements for all users
            try {
                const announcementsRes = await announcementAPI.getLatest(5);
                setAnnouncements(announcementsRes.data.data || []);
            } catch (err) {
                console.error('Error fetching announcements:', err);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
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
            alert(error.response?.data?.message || 'Failed to clock in');
        }
        setClockingIn(false);
    };

    const handleClockOut = async () => {
        setClockingIn(true);
        try {
            await attendanceAPI.clockOut({});
            fetchData();
        } catch (error) {
            alert(error.response?.data?.message || 'Failed to clock out');
        }
        setClockingIn(false);
    };

    const isClockedIn = todayAttendance?.isClockedIn;

    const statColors = [
        { bg: 'bg-primary-100', icon: 'text-primary-600', bar: '#14b8a6' },
        { bg: 'bg-emerald-100', icon: 'text-emerald-600', bar: '#10b981' },
        { bg: 'bg-amber-100', icon: 'text-amber-600', bar: '#f59e0b' },
        { bg: 'bg-accent-100', icon: 'text-accent-600', bar: '#f97316' },
    ];

    // Show skeleton loading
    if (loading) {
        return (
            <div className="space-y-8">
                {/* Header Skeleton */}
                <div className="flex flex-col lg:flex-row gap-6">
                    <div className="flex-1 card-gradient relative overflow-hidden">
                        <div className="relative z-10">
                            <Skeleton className="h-4 w-48 mb-2 bg-white/20" />
                            <Skeleton className="h-8 w-64 mb-2 bg-white/20" />
                            <Skeleton className="h-4 w-80 bg-white/20" />
                        </div>
                    </div>
                    <div className="lg:w-80 card flex flex-col items-center justify-center text-center">
                        <Skeleton className="h-10 w-32 mb-4" />
                        <Skeleton className="h-4 w-24 mb-6" />
                        <Skeleton className="h-14 w-full rounded-xl" />
                    </div>
                </div>

                {/* Stats Skeleton */}
                {canManageEmployees && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <SkeletonCard key={i} />
                        ))}
                    </div>
                )}

                {/* Profile Skeleton */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SkeletonProfile />
                    {canManageEmployees && <SkeletonProfile />}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header Area */}
            <div className="flex flex-col lg:flex-row gap-6">
                {/* Welcome Card */}
                <div className="flex-1 card-gradient relative overflow-hidden animate-fade-in">
                    {/* Decorative Circles */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full"></div>
                    <div className="absolute -bottom-10 -right-20 w-60 h-60 bg-white/5 rounded-full"></div>

                    <div className="relative z-10">
                        <p className="text-primary-100 text-sm font-medium mb-1">
                            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </p>
                        <h1 className="text-2xl md:text-3xl font-bold mb-2">
                            Hello, {employee?.name?.split(' ')[0] || user?.email?.split('@')[0]}! 👋
                        </h1>
                        <p className="text-primary-100">
                            {isClockedIn ? "You're currently working. Keep up the great work!" : "Ready to start your day? Clock in to begin."}
                        </p>

                        {/* Today's Attendance Summary */}
                        {todayAttendance?.attendance && (
                            <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: 'Clock In', value: todayAttendance.attendance.clockIn ? new Date(todayAttendance.attendance.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--' },
                                    { label: 'Clock Out', value: todayAttendance.attendance.clockOut ? new Date(todayAttendance.attendance.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--' },
                                    { label: 'Hours', value: `${todayAttendance.attendance.hoursWorked?.toFixed(1) || '0'}h` },
                                    { label: 'Status', value: todayAttendance.attendance.status || 'pending' },
                                ].map((item, i) => (
                                    <div
                                        key={i}
                                        className="bg-white/10 backdrop-blur-sm rounded-xl px-3 py-2 animate-fade-in"
                                        style={{ animationDelay: `${i * 100}ms` }}
                                    >
                                        <p className="text-primary-200 text-xs">{item.label}</p>
                                        <p className="font-semibold capitalize">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Clock In/Out Card */}
                <div className="lg:w-80 card flex flex-col items-center justify-center text-center animate-fade-in" style={{ animationDelay: '150ms' }}>
                    <div className="text-4xl font-bold text-surface-800 mb-1 tracking-tight tabular-nums">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <p className="text-sm text-surface-500 mb-6">
                        {isClockedIn ? (
                            <span className="inline-flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                                Currently Working
                            </span>
                        ) : (
                            <span className="text-surface-400">Not clocked in</span>
                        )}
                    </p>
                    <button
                        onClick={isClockedIn ? handleClockOut : handleClockIn}
                        disabled={clockingIn}
                        className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] ${isClockedIn
                            ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/30'
                            : 'btn-primary'
                            }`}
                    >
                        {clockingIn ? (
                            <div className="w-6 h-6 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                        ) : isClockedIn ? (
                            <>
                                <Square className="w-5 h-5" />
                                Clock Out
                            </>
                        ) : (
                            <>
                                <Play className="w-5 h-5" />
                                Clock In
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Dashboard Grid Menu */}
            <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
                <DashboardGrid />
            </div>
        </div>
    );
};

export default Dashboard;
