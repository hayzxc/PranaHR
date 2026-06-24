import { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const response = await authAPI.getMe();
            // Backend returns { success: true, data: { user, employee } }
            const { user, employee } = response.data.data;
            setUser(user);
            setEmployee(employee);
        } catch (err) {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('user');
        } finally {
            setLoading(false);
        }
    };

    const login = async (email, password) => {
        try {
            setError(null);
            const response = await authAPI.login({ email, password });
            // Backend returns { success: true, data: { token, refreshToken, user, employee } }
            const { token, refreshToken, user, employee } = response.data.data;

            localStorage.setItem('token', token);
            if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('user', JSON.stringify(user));

            setUser(user);
            setEmployee(employee);

            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || 'Login failed';
            setError(message);
            return { success: false, error: message };
        }
    };

    const register = async (data) => {
        try {
            setError(null);
            const response = await authAPI.register(data);
            // Backend returns { success: true, data: { token, refreshToken, user } }
            const { token, refreshToken, user } = response.data.data;

            localStorage.setItem('token', token);
            if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
            localStorage.setItem('user', JSON.stringify(user));

            setUser(user);

            return { success: true };
        } catch (err) {
            const message = err.response?.data?.message || 'Registration failed';
            setError(message);
            return { success: false, error: message };
        }
    };

    const logout = async () => {
        try {
            await authAPI.logout();
        } catch (err) {
            // Ignore errors
        }
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        setUser(null);
        setEmployee(null);
    };

    const isAdmin = user?.role === 'admin';
    const isHR = user?.role === 'hr';
    const isEmployee = user?.role === 'employee';
    const canManageEmployees = isAdmin || isHR;

    const value = {
        user,
        employee,
        loading,
        error,
        login,
        register,
        logout,
        isAdmin,
        isHR,
        isEmployee,
        canManageEmployees,
        isAuthenticated: !!user,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
