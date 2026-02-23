import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';

// Mock the API module
vi.mock('../../src/services/api', () => ({
    authAPI: {
        login: vi.fn(),
        register: vi.fn(),
        getMe: vi.fn(),
    },
}));

// Import the mocked module
import { authAPI } from '../../src/services/api';

// Helper: component that renders auth context values
function AuthConsumer() {
    const auth = useAuth();
    return (
        <div>
            <div data-testid="loading">{String(auth.loading)}</div>
            <div data-testid="authenticated">{String(auth.isAuthenticated)}</div>
            <div data-testid="user">{auth.user ? auth.user.email : 'null'}</div>
            <div data-testid="role">{auth.user?.role || 'none'}</div>
            <div data-testid="isAdmin">{String(auth.isAdmin)}</div>
            <div data-testid="isHR">{String(auth.isHR)}</div>
            <div data-testid="isEmployee">{String(auth.isEmployee)}</div>
            <div data-testid="canManage">{String(auth.canManageEmployees)}</div>
            <div data-testid="error">{auth.error || 'none'}</div>
            <button data-testid="login-btn" onClick={() => auth.login('test@test.com', 'password123')}>
                Login
            </button>
            <button data-testid="logout-btn" onClick={() => auth.logout()}>
                Logout
            </button>
        </div>
    );
}

describe('AuthContext', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
    });

    describe('useAuth', () => {
        it('should throw when used outside AuthProvider', () => {
            // Suppress console.error for expected error
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            expect(() => {
                render(<AuthConsumer />);
            }).toThrow('useAuth must be used within an AuthProvider');

            consoleSpy.mockRestore();
        });
    });

    describe('Initial state', () => {
        it('should start with loading true and no user when no token', async () => {
            authAPI.getMe.mockRejectedValue(new Error('No token'));

            render(
                <AuthProvider>
                    <AuthConsumer />
                </AuthProvider>,
            );

            // After checkAuth completes, loading should be false
            await waitFor(() => {
                expect(screen.getByTestId('loading').textContent).toBe('false');
            });

            expect(screen.getByTestId('authenticated').textContent).toBe('false');
            expect(screen.getByTestId('user').textContent).toBe('null');
        });

        it('should restore user from token on mount', async () => {
            localStorage.setItem('token', 'valid-token');

            authAPI.getMe.mockResolvedValue({
                data: {
                    data: {
                        user: { email: 'admin@test.com', role: 'admin' },
                        employee: null,
                    },
                },
            });

            render(
                <AuthProvider>
                    <AuthConsumer />
                </AuthProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('loading').textContent).toBe('false');
            });

            expect(screen.getByTestId('authenticated').textContent).toBe('true');
            expect(screen.getByTestId('user').textContent).toBe('admin@test.com');
            expect(screen.getByTestId('isAdmin').textContent).toBe('true');
        });

        it('should clear token if getMe fails', async () => {
            localStorage.setItem('token', 'expired-token');

            authAPI.getMe.mockRejectedValue(new Error('Unauthorized'));

            render(
                <AuthProvider>
                    <AuthConsumer />
                </AuthProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('loading').textContent).toBe('false');
            });

            expect(localStorage.getItem('token')).toBeNull();
            expect(screen.getByTestId('authenticated').textContent).toBe('false');
        });
    });

    describe('login()', () => {
        it('should set user on successful login', async () => {
            const user = userEvent.setup();

            authAPI.getMe.mockRejectedValue(new Error('No token'));
            authAPI.login.mockResolvedValue({
                data: {
                    data: {
                        token: 'new-token',
                        user: { email: 'test@test.com', role: 'employee' },
                        employee: { name: 'Test User' },
                    },
                },
            });

            render(
                <AuthProvider>
                    <AuthConsumer />
                </AuthProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('loading').textContent).toBe('false');
            });

            await user.click(screen.getByTestId('login-btn'));

            await waitFor(() => {
                expect(screen.getByTestId('authenticated').textContent).toBe('true');
            });

            expect(screen.getByTestId('user').textContent).toBe('test@test.com');
            expect(screen.getByTestId('isEmployee').textContent).toBe('true');
            expect(localStorage.getItem('token')).toBe('new-token');
        });

        it('should set error on login failure', async () => {
            const user = userEvent.setup();

            authAPI.getMe.mockRejectedValue(new Error('No token'));
            authAPI.login.mockRejectedValue({
                response: { data: { message: 'Invalid credentials' } },
            });

            render(
                <AuthProvider>
                    <AuthConsumer />
                </AuthProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('loading').textContent).toBe('false');
            });

            await user.click(screen.getByTestId('login-btn'));

            await waitFor(() => {
                expect(screen.getByTestId('error').textContent).toBe('Invalid credentials');
            });

            expect(screen.getByTestId('authenticated').textContent).toBe('false');
        });
    });

    describe('logout()', () => {
        it('should clear user and token on logout', async () => {
            const user = userEvent.setup();

            localStorage.setItem('token', 'valid-token');
            authAPI.getMe.mockResolvedValue({
                data: {
                    data: {
                        user: { email: 'admin@test.com', role: 'admin' },
                        employee: null,
                    },
                },
            });

            render(
                <AuthProvider>
                    <AuthConsumer />
                </AuthProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('authenticated').textContent).toBe('true');
            });

            await user.click(screen.getByTestId('logout-btn'));

            expect(screen.getByTestId('authenticated').textContent).toBe('false');
            expect(screen.getByTestId('user').textContent).toBe('null');
            expect(localStorage.getItem('token')).toBeNull();
        });
    });

    describe('Role flags', () => {
        it('should compute HR flags correctly', async () => {
            localStorage.setItem('token', 'valid-token');
            authAPI.getMe.mockResolvedValue({
                data: {
                    data: {
                        user: { email: 'hr@test.com', role: 'hr' },
                        employee: null,
                    },
                },
            });

            render(
                <AuthProvider>
                    <AuthConsumer />
                </AuthProvider>,
            );

            await waitFor(() => {
                expect(screen.getByTestId('loading').textContent).toBe('false');
            });

            expect(screen.getByTestId('isHR').textContent).toBe('true');
            expect(screen.getByTestId('isAdmin').textContent).toBe('false');
            expect(screen.getByTestId('canManage').textContent).toBe('true');
        });
    });
});
