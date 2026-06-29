import React from 'react';

/**
 * Animated decorative background with hand-drawn SVG doodles, grids, and sketch stars
 */
const DecorativeBackground = () => (
    <div className="absolute inset-0 bg-[#faf6f0] text-slate-800 p-8 overflow-hidden select-none">
        {/* Sketch paper grids */}
        <div className="absolute inset-0 bg-notebook opacity-30 pointer-events-none"></div>

        {/* Hand drawn Sun in top-left */}
        <svg className="absolute top-10 left-10 w-28 h-28 text-amber-500 animate-pulse" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animationDuration: '4s' }}>
            <circle cx="50" cy="50" r="18" strokeDasharray="3 3" />
            <path d="M50 10 L50 22 M50 78 L50 90 M10 50 L22 50 M78 50 L90 50" />
            <path d="M22 22 L30 30 M70 70 L78 78 M22 78 L30 70 M70 22 L78 30" />
        </svg>

        {/* Whimsical hand drawn cloud top-right */}
        <svg className="absolute top-16 right-16 w-32 h-20 text-slate-400/80" viewBox="0 0 100 60" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20,40 Q10,30 20,20 Q30,10 50,20 Q70,5 85,20 Q98,35 80,45 Q75,50 65,47 Q50,55 35,47 Q25,50 20,40 Z" />
        </svg>

        {/* Floating doodles (Hand-drawn Stars) */}
        <svg className="absolute top-1/3 left-12 w-8 h-8 text-yellow-500 animate-bounce" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2 L15 9 L22 10 L17 15 L18 22 L12 18 L6 22 L7 15 L2 10 L9 9 Z" />
        </svg>
        
        {/* Hand sketched heart */}
        <svg className="absolute bottom-32 right-12 w-10 h-10 text-rose-400 animate-float" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animationDelay: '1s' }}>
            <path d="M12 21 C12 21 3 14 3 8.5 C3 5.5 5.5 3 8.5 3 C10.3 3 11.4 4 12 5 C12.6 4 13.7 3 15.5 3 C18.5 3 21 5.5 21 8.5 C21 14 12 21 12 21 Z" />
        </svg>

        {/* Hand drawn arrow pointing to features */}
        <svg className="absolute bottom-28 left-20 w-24 h-24 text-slate-500/60" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 80 Q 40 40 80 30" strokeDasharray="3 3" />
            <path d="M65 20 L80 30 L70 45" />
        </svg>

        {/* Whimsical squiggly loop */}
        <svg className="absolute top-1/2 right-1/4 w-16 h-16 text-teal-500/40" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 50 C20 20, 80 20, 90 50 C95 80, 5 80, 10 50 Z" />
        </svg>

        {/* Squiggly divider line */}
        <svg className="absolute bottom-1/2 left-0 w-full h-8 text-slate-300" viewBox="0 0 500 20" preserveAspectRatio="none" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M0,10 Q25,3 50,10 T100,10 T150,10 T200,10 T250,10 T300,10 T350,10 T400,10 T450,10 T500,10" />
        </svg>
    </div>
);

const roleEmojis = {
    'Admin': '👑',
    'HR Staff': '💼',
    'Employee': '💻'
};

const roleColors = {
    'Admin': 'bg-amber-100 hover:bg-amber-200 border-amber-300',
    'HR Staff': 'bg-rose-100 hover:bg-rose-200 border-rose-300',
    'Employee': 'bg-cyan-100 hover:bg-cyan-200 border-cyan-300'
};

const roleRotations = {
    'Admin': '-rotate-2 hover:rotate-1',
    'HR Staff': 'rotate-3 hover:-rotate-1',
    'Employee': '-rotate-1 hover:rotate-2'
};

/**
 * Demo account card styled like a pinned note paper
 */
const DemoAccountCard = ({ label, email, onClick }) => (
    <div
        className={`p-3 rounded-xl border-2 border-slate-700 shadow-[3px_3px_0px_0px_#1e293b] text-center cursor-pointer relative group transition-spring duration-300 ${roleColors[label] || 'bg-white'} ${roleRotations[label] || ''}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
        {/* Pinned pushpin at the top */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm z-20 transition-transform group-hover:-translate-y-0.5 duration-300">
            📌
        </div>
        <div className="w-9 h-9 rounded-full bg-white/80 border-2 border-slate-700 flex items-center justify-center mx-auto mb-1.5 mt-1 text-base shadow-sm">
            {roleEmojis[label] || '👤'}
        </div>
        <p className="text-slate-800 text-[11px] leading-tight font-bold">{label}</p>
        <p className="text-slate-500 text-[9px] truncate mt-0.5">{email}</p>
    </div>
);

export { DecorativeBackground, DemoAccountCard };
