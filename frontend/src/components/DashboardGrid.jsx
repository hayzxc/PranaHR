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
                    <li key={index}>
                        <button
                            onClick={() => navigate(item.path)}
                            aria-label={`Go to ${item.title}`}
                            className="flex flex-col items-center justify-center p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-1 group border border-gray-100 h-40 w-full focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                        >
                            <div className={`p-4 rounded-xl ${item.color} text-white mb-4 shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                                <item.icon className="w-8 h-8" strokeWidth={2} aria-hidden="true" />
                            </div>
                            <span className="font-semibold text-gray-700 group-hover:text-gray-900 text-sm md:text-base">
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
