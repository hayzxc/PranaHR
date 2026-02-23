/**
 * Animated decorative background with floating orbs, pulsing circles, and particles
 */
const DecorativeBackground = () => (
    <div className="absolute inset-0">
        {/* Floating Orbs */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-white/10 rounded-full blur-3xl animate-float" />
        <div
            className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl animate-float"
            style={{ animationDelay: '1s' }}
        />
        <div
            className="absolute top-1/3 right-1/4 w-48 h-48 bg-blue-300/15 rounded-full blur-2xl animate-float"
            style={{ animationDelay: '2s' }}
        />
        <div
            className="absolute bottom-1/3 left-1/4 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl animate-float"
            style={{ animationDelay: '0.5s' }}
        />

        {/* Pulsing Circles */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-white/20 rounded-full animate-pulse" />
        <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 border border-white/10 rounded-full animate-ping"
            style={{ animationDuration: '3s' }}
        />
        <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border border-white/5 rounded-full animate-pulse"
            style={{ animationDelay: '1.5s' }}
        />

        {/* Rotating Ring */}
        <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] border-2 border-dashed border-white/10 rounded-full animate-spin"
            style={{ animationDuration: '20s' }}
        />

        {/* Moving Particles */}
        <div
            className="absolute top-10 right-10 w-3 h-3 bg-white/40 rounded-full animate-bounce"
            style={{ animationDelay: '0.2s' }}
        />
        <div
            className="absolute bottom-32 left-16 w-2 h-2 bg-cyan-300/50 rounded-full animate-bounce"
            style={{ animationDelay: '0.8s' }}
        />
        <div
            className="absolute top-1/4 right-1/3 w-2 h-2 bg-white/30 rounded-full animate-bounce"
            style={{ animationDelay: '1.2s' }}
        />
    </div>
);

/**
 * Demo account card for quick login
 * @param {Object} props
 * @param {string} props.label - Display label for the account
 * @param {string} props.email - Email address to display
 * @param {string} props.color - Tailwind color classes for the icon
 * @param {Function} props.onClick - Click handler
 */
const DemoAccountCard = ({ label, email, color, onClick }) => (
    <div
        className="p-3 bg-white rounded-xl shadow-soft text-center border border-surface-100 hover:border-primary-200 transition-colors cursor-pointer group"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
        <div
            className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition-transform`}
        >
            {label.charAt(0)}
        </div>
        <p className="font-semibold text-surface-700">{label}</p>
        <p className="text-surface-400 truncate">{email}</p>
    </div>
);

export { DecorativeBackground, DemoAccountCard };
