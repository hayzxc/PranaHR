import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTypewriter } from '../hooks/useTypewriter';
import { DecorativeBackground, DemoAccountCard } from '../components/LoginComponents';
import { LogIn, Mail, Lock, Eye, EyeOff, UserPlus, Sparkles } from 'lucide-react';

// Constants
const TYPEWRITER_WORDS = ['HR Management', 'Payroll', 'Attendance', 'Recruiting'];
const FEATURES = ['Employee Management', 'Payroll System', 'Performance Reviews', 'Document Storage'];
const DEMO_ACCOUNTS = [
    { label: 'Admin', email: 'admin@sobathr.com', password: 'admin123', color: 'bg-accent-100 text-accent-600' },
    { label: 'HR Staff', email: 'hr@sobathr.com', password: 'hr123456', color: 'bg-primary-100 text-primary-600' },
    { label: 'Employee', email: 'budi@pranahr.com', password: 'password123', color: 'bg-emerald-100 text-emerald-600' },
];

/**
 * Login page component with decorative left panel and login form
 */
const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const { login, error } = useAuth();
    const navigate = useNavigate();
    const { typedText, showCursor } = useTypewriter(TYPEWRITER_WORDS);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const result = await login(email, password);

        if (result.success) {
            navigate('/dashboard');
        }

        setIsLoading(false);
    };

    const handleDemoLogin = (account) => {
        setEmail(account.email);
        setPassword(account.password);
    };

    return (
        <div className="min-h-screen flex">
            {/* Left Panel - Decorative */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-blue-900">
                <DecorativeBackground />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16 text-white">
                    {/* Logo & Brand */}
                    <div className="flex items-center gap-4 mb-12">
                        <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-xl border border-white/10">
                            <img src="/logo.png" alt="Prana HR" className="w-9 h-9 object-contain" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">Prana HR</h2>
                            <p className="text-sm text-white/70">Workforce Management System</p>
                        </div>
                    </div>

                    {/* Hero Text with Typewriter */}
                    <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-6">
                        Simplify Your<br />
                        <span className="text-accent-300">
                            {typedText}
                            <span className={`${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity`}>|</span>
                        </span>
                    </h1>
                    <p className="text-lg text-white/80 leading-relaxed max-w-md mb-10">
                        Modern HRIS solution to manage your workforce efficiently.
                        From recruiting to payroll, we've got you covered.
                    </p>

                    {/* Features Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {FEATURES.map((feature, i) => (
                            <div key={i} className="flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/10">
                                <Sparkles className="w-5 h-5 text-accent-300 flex-shrink-0" />
                                <span className="text-sm font-medium">{feature}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-surface-50 relative overflow-hidden">
                {/* Decorative blobs */}
                <div className="absolute top-[-10%] right-[-5%] w-96 h-96 bg-primary-400/15 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-[-10%] left-[-5%] w-96 h-96 bg-accent-400/15 rounded-full blur-3xl pointer-events-none" />
                
                <div className="w-full max-w-md relative z-10 card-glass bg-white/60 p-8 shadow-soft-lg">
                    {/* Mobile Header */}
                    <div className="lg:hidden text-center mb-8">
                        <div className="inline-flex items-center gap-3">
                            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
                                <img src="/logo.png" alt="Prana HR" className="w-8 h-8 object-contain" />
                            </div>
                            <span className="text-2xl font-bold text-surface-800">
                                Prana <span className="text-gradient">HR</span>
                            </span>
                        </div>
                    </div>

                    {/* Welcome Text */}
                    <div className="mb-8">
                        <h2 className="text-3xl font-bold text-surface-800 mb-2">Welcome back! 👋</h2>
                        <p className="text-surface-500">Sign in to continue to your dashboard</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm animate-fade-in flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-red-500" />
                            {error}
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="form-label">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                                <input
                                    type="email"
                                    className="form-input pl-12"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="form-label">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-surface-400" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="form-input pl-12 pr-12"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn btn-primary py-3.5 flex items-center justify-center gap-2 text-base"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>

                    {/* Register Link */}
                    <div className="mt-8 text-center">
                        <span className="text-surface-500">Don't have an account? </span>
                        <Link
                            to="/register"
                            className="text-primary-600 hover:text-primary-700 font-semibold inline-flex items-center gap-1 transition-colors"
                        >
                            <UserPlus className="w-4 h-4" />
                            Create account
                        </Link>
                    </div>

                    {/* Demo Accounts */}
                    <div className="mt-10 pt-8 border-t border-surface-200">
                        <p className="text-xs text-surface-400 text-center mb-4 uppercase tracking-wider font-semibold">
                            Demo Accounts
                        </p>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                            {DEMO_ACCOUNTS.map((account) => (
                                <DemoAccountCard
                                    key={account.email}
                                    label={account.label}
                                    email={account.email}
                                    color={account.color}
                                    onClick={() => handleDemoLogin(account)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
