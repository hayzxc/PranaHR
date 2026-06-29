import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
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
    const { showToast } = useToast();
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
            const promises = [attendanceAPI.getToday()];
            if (canManageEmployees) {
                promises.push(
                    employeeAPI.getStats().catch(() => null),
                    leaveAPI.getStats().catch(() => null)
                );
            }

            const results = await Promise.all(promises);
            setTodayAttendance(results[0].data.data);

            if (canManageEmployees) {
                if (results[1]) setStats(results[1].data.data);
                if (results[2]) setLeaveStats(results[2].data.data);
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
                <div className="flex-1 rounded-3xl bg-gradient-to-br from-primary-800 via-primary-600 to-teal-500 text-white p-8 relative overflow-hidden shadow-soft-lg animate-fade-in border border-primary-700/30">
                    {/* Decorative pulsing blobs */}
                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-xl animate-pulse" style={{ animationDuration: '4s' }}></div>
                    <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-accent-500/10 rounded-full blur-2xl animate-float"></div>
                    <div className="absolute top-1/2 left-1/3 w-32 h-32 bg-teal-300/10 rounded-full blur-xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>

                    <div className="relative z-10">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-wider bg-white/10 backdrop-blur-md text-primary-50 mb-4 border border-white/10 uppercase">
                            <Calendar className="w-3.5 h-3.5" />
                            {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                        <h1 className="text-3xl md:text-4xl font-extrabold mb-2 tracking-tight">
                            Hello, {employee?.name?.split(' ')[0] || user?.email?.split('@')[0]}! 👋
                        </h1>
                        <p className="text-primary-100/90 max-w-md text-sm md:text-base leading-relaxed">
                            {isClockedIn ? "You're currently clocked in. Keep up the excellent performance!" : "Ready for a productive day? Clock in to log your hours."}
                        </p>

                        {/* Today's Attendance Summary */}
                        {todayAttendance?.attendance && (
                            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[
                                    { label: 'Clock In', value: todayAttendance.attendance.clockIn ? new Date(todayAttendance.attendance.clockIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--' },
                                    { label: 'Clock Out', value: todayAttendance.attendance.clockOut ? new Date(todayAttendance.attendance.clockOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--' },
                                    { label: 'Hours Worked', value: `${todayAttendance.attendance.hoursWorked?.toFixed(1) || '0.0'}h` },
                                    { label: 'Shift Status', value: todayAttendance.attendance.status || 'pending' },
                                ].map((item, i) => (
                                    <div
                                        key={i}
                                        className="bg-white/15 backdrop-blur-md rounded-2xl p-3 border border-white/10 shadow-inner-soft hover:bg-white/20 transition-all duration-300"
                                    >
                                        <p className="text-primary-200 text-xs font-medium uppercase tracking-wider mb-1">{item.label}</p>
                                        <p className="font-bold text-base md:text-lg tracking-tight capitalize">{item.value}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Clock In/Out Card */}
                <div className="lg:w-80 glass-premium rounded-3xl p-6 flex flex-col items-center justify-center text-center animate-fade-in border border-white/80 shadow-soft-lg hover:shadow-soft-lg hover:border-primary-200/40 transition-spring" style={{ animationDelay: '150ms' }}>
                    {/* Status Circle Ring */}
                    <div className="relative w-28 h-28 mb-4 flex items-center justify-center">
                        <div className={`absolute inset-0 rounded-full border-4 border-dashed transition-all duration-1000 ${
                            isClockedIn ? 'border-emerald-500 animate-spin' : 'border-surface-200'
                        }`} style={{ animationDuration: '15s' }}></div>
                        <div className={`absolute w-24 h-24 rounded-full bg-surface-50 flex flex-col items-center justify-center shadow-inner ${
                            isClockedIn ? 'ring-4 ring-emerald-500/20' : 'ring-4 ring-surface-100/50'
                        }`}>
                            <Clock className={`w-8 h-8 ${isClockedIn ? 'text-emerald-500 animate-pulse' : 'text-surface-400'}`} />
                        </div>
                    </div>

                    <div className="text-3xl font-extrabold text-surface-800 mb-1 tracking-tight tabular-nums">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <p className="text-xs font-semibold text-surface-500 mb-6">
                        {isClockedIn ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
                                ON DUTY
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-100 text-surface-600 border border-surface-200">
                                STANDBY
                            </span>
                        )}
                    </p>
                    <button
                        onClick={isClockedIn ? handleClockOut : handleClockIn}
                        disabled={clockingIn}
                        className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-bold text-base transition-all transform hover:-translate-y-0.5 active:translate-y-0 shadow-lg ${isClockedIn
                            ? 'bg-gradient-to-r from-red-500 via-rose-500 to-red-600 text-white shadow-glow-rose hover:shadow-red-500/40 hover:scale-[1.02]'
                            : 'btn-primary shadow-glow-teal hover:scale-[1.02]'
                            }`}
                    >
                        {clockingIn ? (
                            <div className="w-5 h-5 border-2 border-current/30 border-t-current rounded-full animate-spin"></div>
                        ) : isClockedIn ? (
                            <>
                                <Square className="w-4.5 h-4.5 fill-current" />
                                Clock Out
                            </>
                        ) : (
                            <>
                                <Play className="w-4.5 h-4.5 fill-current" />
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
