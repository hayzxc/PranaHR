import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import NotificationPanel from './NotificationPanel';
import {
    LayoutDashboard,
    Users,
    Calendar,
    Clock,
    LogOut,
    Menu,
    X,
    Bell,
    ChevronDown,
    UserPlus,
    ClipboardList,
    ClipboardCheck,
    DollarSign,
    BarChart3,
    Settings as SettingsIcon,
    FileText,
    Megaphone,
    Award,
    ChevronsLeft,
    ChevronsRight,
    Crosshair,
    Network,
    Sun,
    Moon
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useState, useEffect, useRef } from 'react';

const Layout = () => {
    const { user, employee, logout, canManageEmployees, isAdmin } = useAuth();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const [sidebarOpen, setSidebarOpen] = useState(false);       // mobile toggle
    const [sidebarExpanded, setSidebarExpanded] = useState(false); // desktop hover/pin
    const [sidebarPinned, setSidebarPinned] = useState(false);    // user can pin it open
    const [profileOpen, setProfileOpen] = useState(false);
    const [notifOpen, setNotifOpen] = useState(false);
    const [animateNav, setAnimateNav] = useState(false);
    const { unreadCount } = useNotifications();

    // Trigger nav animation when mobile sidebar opens
    useEffect(() => {
        if (sidebarOpen) {
            setAnimateNav(true);
        } else {
            setAnimateNav(false);
        }
    }, [sidebarOpen]);

    const profileRef = useRef(null);
    const notifRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setNotifOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const isExpanded = sidebarExpanded || sidebarPinned;

    const navItems = [
        { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
        { to: '/tasks', icon: ClipboardList, label: 'Tasks' },
        
        { header: 'Management' },
        ...(canManageEmployees ? [{ to: '/employees', icon: Users, label: 'Employees' }] : []),
        ...(canManageEmployees ? [{ to: '/org-chart', icon: Network, label: 'Org Chart' }] : []),
        ...(canManageEmployees ? [{ to: '/recruiting', icon: UserPlus, label: 'Recruiting' }] : []),
        ...(canManageEmployees ? [{ to: '/onboarding', icon: ClipboardCheck, label: 'Onboarding' }] : []),
        
        { header: 'Operations' },
        ...(canManageEmployees ? [{ to: '/payroll', icon: DollarSign, label: 'Payroll' }] : []),
        ...(canManageEmployees ? [{ to: '/documents', icon: FileText, label: 'Documents' }] : []),
        { to: '/certificate-generator', icon: Award, label: 'Certificate' },
        ...(canManageEmployees ? [{ to: '/announcements', icon: Megaphone, label: 'Announcements' }] : []),
        
        { header: 'Time & Growth' },
        { to: '/leaves', icon: Calendar, label: 'Time Off' },
        { to: '/attendance', icon: Clock, label: 'Attendance' },
        { to: '/okr', icon: Crosshair, label: 'Performance & KPI' },
        ...(canManageEmployees ? [{ to: '/reports', icon: BarChart3, label: 'Reports' }] : []),
        ...(isAdmin ? [{ to: '/settings', icon: SettingsIcon, label: 'Settings' }] : []),
    ];

    const getRoleBadge = () => {
        switch (user?.role) {
            case 'admin': return 'badge badge-accent';
            case 'hr': return 'badge badge-primary';
            default: return 'badge badge-success';
        }
    };

    return (
        <div className="min-h-screen">
            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-surface-900/40 z-40 lg:hidden backdrop-blur-sm transition-all duration-300"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                role="navigation"
                aria-label="Main navigation"
                className={`
                    fixed top-0 left-0 z-50 h-full flex flex-col
                    glass-premium border-r border-white/50
                    shadow-soft-lg
                    transition-all duration-300 ease-in-out
                    ${sidebarOpen ? 'w-72 translate-x-0' : '-translate-x-full'}
                    lg:translate-x-0
                    ${isExpanded ? 'lg:w-72' : 'lg:w-20'}
                `}
                onMouseEnter={() => !sidebarPinned && setSidebarExpanded(true)}
                onMouseLeave={() => !sidebarPinned && setSidebarExpanded(false)}
            >
                {/* Sidebar Header */}
                <div className={`h-20 flex items-center border-b border-white/40 transition-all duration-300 ${isExpanded ? 'justify-between px-6' : 'justify-center px-2 lg:px-0'}`}>
                    <div className="flex items-center gap-3">
                        <div className="relative group cursor-pointer">
                            <div className="absolute inset-0 bg-primary-400 blur-lg opacity-30 group-hover:opacity-60 transition-opacity rounded-xl animate-pulse"></div>
                            <div className="relative w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-soft transform group-hover:scale-110 transition-all duration-300 animate-float">
                                <img src="/logo.png" alt="Sobat HR Logo" className="w-6 h-6 object-contain" />
                            </div>
                        </div>
                        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded ? 'opacity-100 max-w-[200px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-4 pointer-events-none'}`}>
                            <h1 className="text-xl font-bold text-surface-800 tracking-tight leading-none whitespace-nowrap">
                                Prana <span className="text-primary-600">HR</span>
                            </h1>
                            <p className="text-[10px] uppercase tracking-wider text-surface-500 font-semibold mt-0.5 whitespace-nowrap">Workforce OS</p>
                        </div>
                    </div>
                    {/* Mobile close button */}
                    <button
                        className="lg:hidden text-surface-400 hover:text-surface-600 p-2 hover:bg-surface-100 rounded-xl transition-all active:scale-90"
                        onClick={() => setSidebarOpen(false)}
                        aria-label="Close sidebar"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                {/* Pin / Unpin Button — Desktop only */}
                <div className={`hidden lg:flex items-center transition-all duration-300 ${isExpanded ? 'justify-end px-4 py-2' : 'justify-center py-2'}`}>
                    <button
                        onClick={() => setSidebarPinned(!sidebarPinned)}
                        className={`p-1.5 rounded-lg transition-all duration-200 ${sidebarPinned ? 'bg-primary-100 text-primary-600' : 'text-surface-400 hover:bg-surface-100 hover:text-surface-600'}`}
                        title={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                        aria-label={sidebarPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                    >
                        {sidebarPinned ? <ChevronsLeft className="w-4 h-4" aria-hidden="true" /> : <ChevronsRight className="w-4 h-4" aria-hidden="true" />}
                    </button>
                </div>

                {/* Navigation */}
                <nav aria-label="Sidebar menu" className={`flex-1 min-h-0 overflow-y-auto space-y-1 transition-all duration-300 ${isExpanded ? 'p-4' : 'p-2 lg:p-2'}`}>
                    {navItems.map((item, index) => {
                        if (item.header) {
                            return (
                                <p
                                    key={`header-${index}`}
                                    className={`text-[10px] font-bold text-surface-400 dark:text-surface-500 uppercase tracking-widest mt-6 mb-2 transition-all duration-300 ease-in-out ${
                                        isExpanded ? 'px-4 opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 pointer-events-none h-0 mt-0 mb-0 overflow-hidden'
                                    }`}
                                >
                                    {item.header}
                                </p>
                            );
                        }

                        return (
                            <NavLink
                                key={item.to}
                                to={item.to}
                                className={({ isActive }) => `
                                    sidebar-link group relative
                                    ${isActive ? 'active' : ''}
                                    ${animateNav ? 'animate-fade-in opacity-0' : ''}
                                    ${!isExpanded ? 'lg:justify-center' : ''}
                                `}
                                style={animateNav ? { animationDelay: `${index * 40}ms` } : {}}
                                onClick={() => setSidebarOpen(false)}
                                title={!isExpanded ? item.label : undefined}
                            >
                                {({ isActive }) => (
                                    <>
                                        {isActive && (
                                            <div className="absolute left-0 top-1/4 h-1/2 w-1 bg-primary-600 rounded-r-full" />
                                        )}
                                        <div className={`p-2 rounded-xl transition-all duration-200 
                                            ${isActive ? 'bg-white/20' : 'group-hover:bg-primary-100'}`}>
                                            <item.icon className="w-5 h-5 nav-icon transition-transform duration-300 group-hover:scale-110" aria-hidden="true" />
                                        </div>
                                        <span className={`font-medium whitespace-nowrap transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 max-w-[200px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-4 overflow-hidden pointer-events-none'}`}>
                                            {item.label}
                                        </span>
                                    </>
                                )}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* User info at bottom */}
                <div className={`mt-auto border-t border-surface-100 bg-surface-50/50 transition-all duration-300 ${isExpanded ? 'p-4' : 'p-2 lg:p-2'}`}>
                    <div className={`flex items-center gap-3 mb-3 p-2 rounded-xl hover:bg-white transition-colors cursor-pointer ${!isExpanded ? 'lg:justify-center' : ''}`}>
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-md flex-shrink-0">
                            <span className="text-white font-bold">
                                {(employee?.name || user?.email)?.[0]?.toUpperCase()}
                            </span>
                        </div>
                        <div className={`flex-1 min-w-0 transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 max-w-[200px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-4 overflow-hidden pointer-events-none'}`}>
                            <p className="font-semibold text-surface-800 truncate">
                                {employee?.name || user?.email?.split('@')[0]}
                            </p>
                            <span className={getRoleBadge()}>
                                {user?.role?.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={handleLogout}
                        aria-label="Sign out"
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 active:scale-95 group font-medium ${isExpanded ? 'justify-start' : 'justify-center'}`}
                    >
                        <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" aria-hidden="true" />
                        <span className={`transition-all duration-300 ease-in-out ${isExpanded ? 'opacity-100 max-w-[200px] translate-x-0' : 'opacity-0 max-w-0 -translate-x-4 overflow-hidden pointer-events-none'}`}>
                            Sign Out
                        </span>
                    </button>
                </div>
            </aside>

            {/* Main content */}
            <div className={`transition-all duration-300 ${isExpanded ? 'lg:ml-72' : 'lg:ml-20'}`}>
                {/* Top bar */}
                <header className="h-20 bg-white/60 backdrop-blur-2xl border-b border-white/50 flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30 shadow-sm shadow-surface-100/5">
                    <button
                        className="lg:hidden p-2.5 text-surface-600 hover:bg-surface-100 rounded-xl transition-all active:scale-90"
                        onClick={() => setSidebarOpen(true)}
                        aria-label="Open menu"
                    >
                        <Menu className="w-6 h-6" aria-hidden="true" />
                    </button>

                    <div className="flex-1 lg:flex-none">
                        <h1 className="hidden lg:block text-lg font-semibold text-surface-700">
                            Welcome back! 👋
                        </h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            className="p-2.5 text-surface-500 hover:text-surface-700 hover:bg-surface-100 dark:text-surface-400 dark:hover:text-surface-200 dark:hover:bg-surface-800 rounded-xl transition-all active:scale-90"
                            aria-label="Toggle theme"
                        >
                            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>

                        {/* Notifications */}
                        <div className="relative" ref={notifRef}>
                            <button
                                className="relative p-2.5 text-surface-500 hover:text-surface-700 hover:bg-surface-100 rounded-xl transition-all active:scale-90 group"
                                onClick={() => {
                                    setNotifOpen(!notifOpen);
                                    setProfileOpen(false);
                                }}
                                aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                            >
                                <Bell className="w-5 h-5" />
                                {unreadCount > 0 && (
                                    <span
                                        className="absolute flex items-center justify-center rounded-full ring-2 ring-white"
                                        style={{
                                            top: '4px',
                                            right: '4px',
                                            minWidth: unreadCount > 9 ? '18px' : '14px',
                                            height: unreadCount > 9 ? '18px' : '14px',
                                            padding: unreadCount > 9 ? '0 4px' : '0',
                                            fontSize: '9px',
                                            fontWeight: 700,
                                            lineHeight: 1,
                                            color: 'white',
                                            backgroundColor: '#ef4444',
                                        }}
                                    >
                                        {unreadCount > 99 ? '99+' : unreadCount > 0 ? unreadCount : ''}
                                    </span>
                                )}
                            </button>
                            <NotificationPanel
                                isOpen={notifOpen}
                                onClose={() => setNotifOpen(false)}
                            />
                        </div>

                        {/* Profile dropdown */}
                        <div className="relative" ref={profileRef}>
                            <button
                                className="flex items-center gap-3 p-2 hover:bg-surface-100 rounded-xl transition-all active:scale-95"
                                onClick={() => setProfileOpen(!profileOpen)}
                                aria-label="User profile menu"
                                aria-expanded={profileOpen}
                            >
                                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-sm">
                                    <span className="text-white font-semibold text-sm">
                                        {(employee?.name || user?.email)?.[0]?.toUpperCase()}
                                    </span>
                                </div>
                                <span className="hidden md:block font-medium text-surface-700">
                                    {employee?.name || user?.email?.split('@')[0]}
                                </span>
                                <ChevronDown className={`w-4 h-4 text-surface-400 transition-transform duration-300 ${profileOpen ? 'rotate-180' : ''}`} />
                            </button>

                            {profileOpen && (
                                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-soft-lg border border-surface-100 py-2 animate-scale-in">
                                    <div className="px-4 py-3 border-b border-surface-100">
                                        <p className="font-semibold text-surface-800">{employee?.name}</p>
                                        <p className="text-sm text-surface-500">{user?.email}</p>
                                    </div>
                                    <div className="p-2">
                                        <button
                                            onClick={handleLogout}
                                            className="w-full px-3 py-2.5 text-left text-red-600 hover:bg-red-50 rounded-xl flex items-center gap-3 transition-all group font-medium"
                                        >
                                            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                            Sign Out
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="p-4 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default Layout;
