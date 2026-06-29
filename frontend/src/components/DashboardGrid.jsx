import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users,
    Calendar,
    Clock,
    DollarSign,
    ClipboardList,
    UserPlus,
    ClipboardCheck,
    FileText,
    Megaphone,
    BarChart3,
    Settings,
    Award,
    Crosshair,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const glowColorMap = {
    'bg-orange-500': 'hover:shadow-glow-orange hover:border-orange-500/30',
    'bg-purple-500': 'hover:shadow-glow-purple hover:border-purple-500/30',
    'bg-blue-500': 'hover:shadow-glow-blue hover:border-blue-500/30',
    'bg-sky-500': 'hover:shadow-glow-sky hover:border-sky-500/30',
    'bg-indigo-500': 'hover:shadow-glow-indigo hover:border-indigo-500/30',
    'bg-cyan-500': 'hover:shadow-glow-cyan hover:border-cyan-500/30',
    'bg-teal-500': 'hover:shadow-glow-teal hover:border-teal-500/30',
    'bg-green-600': 'hover:shadow-glow-green hover:border-green-600/30',
    'bg-amber-500': 'hover:shadow-glow-amber hover:border-amber-500/30',
    'bg-rose-500': 'hover:shadow-glow-rose hover:border-rose-500/30',
    'bg-violet-600': 'hover:shadow-glow-violet hover:border-violet-600/30',
    'bg-pink-500': 'hover:shadow-glow-pink hover:border-pink-500/30',
    'bg-gray-600': 'hover:shadow-glow-accent hover:border-accent-500/30'
};

const DashboardGrid = () => {
    const navigate = useNavigate();
    const { canManageEmployees, isAdmin } = useAuth();

    const menuItems = [
        {
            title: 'Attendance',
            icon: Clock,
            path: '/attendance',
            color: 'bg-orange-500',
            description: 'Clock in/out & logs',
            allowed: true
        },
        {
            title: 'Time Off',
            icon: Calendar,
            path: '/leaves',
            color: 'bg-purple-500',
            description: 'Leave requests',
            allowed: true
        },
        {
            title: 'Tasks',
            icon: ClipboardList,
            path: '/tasks',
            color: 'bg-blue-500',
            description: 'My tasks & projects',
            allowed: true
        },
        {
            title: 'Performance & KPI',
            icon: Crosshair,
            path: '/okr',
            color: 'bg-sky-500',
            description: 'OKR & KPI tracking',
            allowed: true
        },
        {
            title: 'Employees',
            icon: Users,
            path: '/employees',
            color: 'bg-indigo-500',
            description: 'Team directory',
            allowed: canManageEmployees
        },
        {
            title: 'Recruiting',
            icon: UserPlus,
            path: '/recruiting',
            color: 'bg-cyan-500',
            description: 'Job applications',
            allowed: canManageEmployees
        },
        {
            title: 'Onboarding',
            icon: ClipboardCheck,
            path: '/onboarding',
            color: 'bg-teal-500',
            description: 'New hire setup',
            allowed: canManageEmployees
        },
        {
            title: 'Payroll',
            icon: DollarSign,
            path: '/payroll',
            color: 'bg-green-600',
            description: 'Salary & payslips',
            allowed: canManageEmployees
        },
        {
            title: 'Documents',
            icon: FileText,
            path: '/documents',
            color: 'bg-amber-500',
            description: 'Company files',
            allowed: canManageEmployees
        },
        {
            title: 'Announcements',
            icon: Megaphone,
            path: '/announcements',
            color: 'bg-rose-500',
            description: 'News & updates',
            allowed: canManageEmployees
        },
        {
            title: 'Reports',
            icon: BarChart3,
            path: '/reports',
            color: 'bg-violet-600',
            description: 'Analytics & insights',
            allowed: canManageEmployees
        },
        {
            title: 'Certificates',
            icon: Award,
            path: '/certificate-generator',
            color: 'bg-pink-500',
            description: 'Generate docs',
            allowed: true
        },
        {
            title: 'Settings',
            icon: Settings,
            path: '/settings',
            color: 'bg-gray-600',
            description: 'System config',
            allowed: isAdmin
        }
    ];

    const visibleItems = menuItems.filter(item => item.allowed);

    return (
        <nav aria-label="Dashboard modules">
            <ul className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6 p-4 list-none m-0">
                {visibleItems.map((item, index) => (
                    <li key={index} className="animate-scale-in" style={{ animationDelay: `${index * 40}ms` }}>
                        <button
                            onClick={() => navigate(item.path)}
                            aria-label={`Go to ${item.title}`}
                            className={`flex flex-col items-center justify-center p-6 bg-white/70 backdrop-blur-md rounded-2xl shadow-soft hover:bg-white border border-white/80 h-40 w-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-spring hover:-translate-y-1.5 group ${glowColorMap[item.color] || ''}`}
                        >
                            <div className={`p-3.5 rounded-2xl ${item.color} text-white mb-3.5 shadow-md group-hover:scale-110 group-hover:rotate-3 transition-spring duration-300`}>
                                <item.icon className="w-8 h-8" strokeWidth={2} aria-hidden="true" />
                            </div>
                            <span className="font-bold text-surface-700 group-hover:text-surface-900 text-sm md:text-base tracking-tight transition-colors">
                                {item.title}
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default DashboardGrid;
