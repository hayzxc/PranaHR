import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

let toastId = 0;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const showToast = useCallback((message, type = 'info', duration = 4000) => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type }]);

        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, duration);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const value = { showToast };

    return (
        <ToastContext.Provider value={value}>
            {children}
            {/* Toast Container */}
            {toasts.length > 0 && (
                <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
                    {toasts.map((toast) => (
                        <div
                            key={toast.id}
                            className={`pointer-events-auto flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-lg border backdrop-blur-sm animate-slide-up max-w-sm ${toast.type === 'success'
                                    ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800'
                                    : toast.type === 'error'
                                        ? 'bg-red-50/95 border-red-200 text-red-800'
                                        : toast.type === 'warning'
                                            ? 'bg-amber-50/95 border-amber-200 text-amber-800'
                                            : 'bg-cyan-50/95 border-cyan-200 text-cyan-800'
                                }`}
                            role="alert"
                        >
                            <span className="text-lg flex-shrink-0">
                                {toast.type === 'success' ? '✅' :
                                    toast.type === 'error' ? '❌' :
                                        toast.type === 'warning' ? '⚠️' : 'ℹ️'}
                            </span>
                            <p className="text-sm font-medium flex-1">{toast.message}</p>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className="flex-shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity p-0.5"
                                aria-label="Dismiss"
                            >
                                ✕
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </ToastContext.Provider>
    );
};

export default ToastContext;
