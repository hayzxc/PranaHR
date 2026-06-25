import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import { lazy, Suspense } from 'react';

// Lazy-loaded pages — each becomes its own chunk, loaded on demand
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Employees = lazy(() => import('./pages/Employees'));
const OrgChart = lazy(() => import('./pages/OrgChart'));
const Leaves = lazy(() => import('./pages/Leaves'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Recruiting = lazy(() => import('./pages/Recruiting'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const Payroll = lazy(() => import('./pages/Payroll'));

const Reports = lazy(() => import('./pages/Reports'));
const Settings = lazy(() => import('./pages/Settings'));
const Documents = lazy(() => import('./pages/Documents'));
const Announcements = lazy(() => import('./pages/Announcements'));
const Tasks = lazy(() => import('./pages/Tasks'));
const CertificateGenerator = lazy(() => import('./pages/CertificateGenerator'));
const OKR = lazy(() => import('./pages/OKR'));

import './index.css';

// Loading fallback for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Loading page">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
      <p className="text-sm text-surface-500 font-medium">Loading...</p>
    </div>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <ToastProvider>
          <Router>
            <Suspense fallback={<PageLoader />}>
              <ErrorBoundary>
                <Routes>
                  {/* Public routes */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />

                  {/* Protected routes */}
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Layout />
                      </ProtectedRoute>
                    }
                  >
                    <Route index element={<Navigate to="/dashboard" replace />} />
                    <Route path="dashboard" element={<Dashboard />} />
                    <Route
                      path="employees"
                      element={
                        <ProtectedRoute roles={['admin', 'hr']}>
                          <Employees />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="org-chart"
                      element={
                        <ProtectedRoute roles={['admin', 'hr']}>
                          <OrgChart />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="recruiting"
                      element={
                        <ProtectedRoute roles={['admin', 'hr']}>
                          <Recruiting />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="onboarding"
                      element={
                        <ProtectedRoute roles={['admin', 'hr']}>
                          <Onboarding />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="payroll"
                      element={
                        <ProtectedRoute roles={['admin', 'hr']}>
                          <Payroll />
                        </ProtectedRoute>
                      }
                    />
                    <Route path="leaves" element={<Leaves />} />
                    <Route path="attendance" element={<Attendance />} />
                    <Route path="performance" element={<Navigate to="/okr" replace />} />
                    <Route path="okr" element={<OKR />} />
                    <Route
                      path="reports"
                      element={
                        <ProtectedRoute roles={['admin', 'hr']}>
                          <Reports />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="settings"
                      element={
                        <ProtectedRoute roles={['admin']}>
                          <Settings />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="documents"
                      element={
                        <ProtectedRoute roles={['admin', 'hr']}>
                          <Documents />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="announcements"
                      element={
                        <ProtectedRoute roles={['admin', 'hr']}>
                          <Announcements />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="tasks"
                      element={
                        <ProtectedRoute>
                          <Tasks />
                        </ProtectedRoute>
                      }
                    />
                    <Route
                      path="certificate-generator"
                      element={
                        <ProtectedRoute>
                          <CertificateGenerator />
                        </ProtectedRoute>
                      }
                    />
                  </Route>

                  {/* Catch all */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </ErrorBoundary>
            </Suspense>
          </Router>
        </ToastProvider>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
