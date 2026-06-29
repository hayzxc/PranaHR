import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTypewriter } from '../hooks/useTypewriter';
import { DecorativeBackground, DemoAccountCard } from '../components/LoginComponents';
import { LogIn, Mail, Lock, Eye, EyeOff, UserPlus, Sparkles } from 'lucide-react';

// Constants
const TYPEWRITER_WORDS = ['HR Magic ✨', 'Happy Paydays 💸', 'Sunny Time Off 🏖️', 'Smart Recruiting 🚀', 'Team High-Fives 🙌'];
const FEATURES = [
    { text: 'Joyful Onboarding', emoji: '🎉', color: 'bg-amber-100' },
    { text: 'Automated Payroll', emoji: '💰', color: 'bg-green-100' },
    { text: 'Performance Goals', emoji: '🎯', color: 'bg-rose-100' },
    { text: 'Secure Cloud Files', emoji: '🔒', color: 'bg-cyan-100' },
];
const DEMO_ACCOUNTS = [
    { label: 'Admin', email: 'admin@sobathr.com', password: 'admin123', color: 'bg-accent-100 text-accent-600' },
    { label: 'HR Staff', email: 'hr@sobathr.com', password: 'hr123456', color: 'bg-primary-100 text-primary-600' },
    { label: 'Employee', email: 'john@sobathr.com', password: 'password123', color: 'bg-emerald-100 text-emerald-600' },
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
        <div className="min-h-screen flex font-sans">
            {/* Left Panel - Decorative Doodle Sketchbook */}
            <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-[#faf6f0] border-r-4 border-slate-800">
                <DecorativeBackground />

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-center px-12 lg:px-16 text-slate-800">
                    {/* Logo & Brand */}
                    <div className="flex items-center gap-4 mb-12 select-none">
                        <div className="w-14 h-14 bg-white border-4 border-slate-800 shadow-[4px_4px_0px_0px_#1e293b] rounded-2xl flex items-center justify-center animate-float">
                            <img src="/logo.png" alt="Prana HR" className="w-9 h-9 object-contain" />
                        </div>
                        <div>
                            <h2 className="text-3xl font-black tracking-tight leading-none text-slate-800">Prana HR</h2>
                            <p className="text-[10px] tracking-widest text-slate-500 font-bold uppercase mt-1">Workforce OS</p>
                        </div>
                    </div>

                    {/* Hero Text with Typewriter */}
                    <h1 className="text-4xl lg:text-5xl font-black leading-tight mb-6 tracking-tight text-slate-800">
                        Powering Your<br />
                        <span className="text-primary-700 relative inline-block mt-2">
                            {typedText}
                            {/* Sketch double-scribble underline SVG */}
                            <svg className="absolute -bottom-3 left-0 w-full h-4 text-accent-500" viewBox="0 0 100 12" preserveAspectRatio="none">
                                <path d="M5,7 Q25,3 45,8 T85,6 T95,8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                                <path d="M8,9 Q35,6 60,9 T92,7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.8" />
                            </svg>
                            <span className={`${showCursor ? 'opacity-100' : 'opacity-0'} transition-opacity`}>|</span>
                        </span>
                    </h1>
                    <p className="text-slate-600 font-medium leading-relaxed max-w-md mb-10 text-lg">
                        A warm, human-centric workspace OS that employees actually love using. Time off, payroll, performance, and more!
                    </p>

                    {/* Features Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {FEATURES.map((item, i) => (
                            <div key={i} className={`flex items-center gap-3 bg-white border-2 border-slate-800 p-3.5 shadow-[3.5px_3.5px_0px_0px_#1e293b] hover:-translate-y-0.5 transition-spring duration-300 ${
                                i % 4 === 0 ? 'rotate-[-1.5deg] rounded-[20px_100px_15px_90px/100px_15px_95px_15px]' :
                                i % 4 === 1 ? 'rotate-[1deg] rounded-[100px_20px_90px_10px/15px_95px_15px_100px]' :
                                i % 4 === 2 ? 'rotate-[1.5deg] rounded-[15px_95px_15px_100px/100px_20px_90px_10px]' :
                                'rotate-[-1deg] rounded-[95px_15px_100px_15px/20px_90px_10px_100px]'
                            }`}>
                                <div className={`w-8 h-8 rounded-full border-2 border-slate-800 flex items-center justify-center text-sm flex-shrink-0 rotate-[-4deg] ${item.color}`}>
                                    {item.emoji}
                                </div>
                                <span className="text-sm font-bold text-slate-800">{item.text}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Right Panel - Login Form */}
            <div className="flex-1 flex items-center justify-center p-8 bg-[#f5f2eb] relative overflow-hidden">
                {/* Sketchy Background grid lines */}
                <div className="absolute inset-0 bg-notebook opacity-10 pointer-events-none"></div>
                <div className="absolute top-20 right-20 w-16 h-16 text-slate-300 animate-float pointer-events-none">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L12 22M2 12L22 12" strokeDasharray="3 3"/></svg>
                </div>
                
                {/* Notebook sheet card */}
                <div className="w-full max-w-md relative z-10 card-doodle p-8 -rotate-1 hover:rotate-0 transition-spring duration-500 bg-white">
                    {/* Hand drawn notebook margin decoration */}
                    <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-red-400/40 pointer-events-none"></div>

                    {/* Mobile Header */}
                    <div className="lg:hidden text-center mb-8 pl-4">
                        <div className="inline-flex items-center gap-3">
                            <div className="w-12 h-12 bg-white border-3 border-slate-800 shadow-[3px_3px_0px_0px_#1e293b] rounded-xl flex items-center justify-center animate-float">
                                <img src="/logo.png" alt="Prana HR" className="w-8 h-8 object-contain" />
                            </div>
                            <span className="text-2xl font-bold text-slate-800">
                                Prana <span className="text-primary-600">HR</span>
                            </span>
                        </div>
                    </div>

                    {/* Welcome Text */}
                    <div className="mb-8 pl-4 select-none">
                        <h2 className="text-3xl font-extrabold text-slate-800 mb-1 tracking-tight">Welcome back! 👋</h2>
                        <p className="text-slate-500 text-sm">Sign in to continue to your dashboard</p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 ml-4 p-4 bg-rose-50 border-2 border-slate-700 rounded-xl text-rose-700 text-sm animate-fade-in flex items-center gap-2 font-bold shadow-[2px_2px_0px_0px_#1e293b]">
                            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                            {error}
                        </div>
                    )}

                    {/* Login Form */}
                    <form onSubmit={handleSubmit} className="space-y-5 pl-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-slate-700 transition-colors duration-300" />
                                <input
                                    type="email"
                                    className="input-doodle pl-12 font-medium text-slate-800"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-slate-700 transition-colors duration-300" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="input-doodle pl-12 pr-12 font-medium text-slate-800"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full btn-doodle py-3.5 flex items-center justify-center gap-2 text-base"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5 stroke-[2.5]" />
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>

                    {/* Register Link */}
                    <div className="mt-8 text-center pl-4">
                        <span className="text-slate-500">Don't have an account? </span>
                        <Link
                            to="/register"
                            className="text-primary-600 hover:text-primary-700 font-bold inline-flex items-center gap-1 transition-colors hover:underline text-sm"
                        >
                            <UserPlus className="w-4 h-4" />
                            Create account
                        </Link>
                    </div>

                    {/* Demo Accounts */}
                    <div className="mt-8 pt-6 border-t-2 border-dashed border-slate-300 pl-4">
                        <p className="text-[10px] text-slate-400 text-center mb-4 uppercase tracking-widest font-black">
                            📌 Quick Demo Accounts
                        </p>
                        <div className="grid grid-cols-3 gap-3">
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
