import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - add token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor - handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth APIs
export const authAPI = {
    login: (data) => api.post('/auth/login', data),
    register: (data) => api.post('/auth/register', data),
    getMe: () => api.get('/auth/me'),
};

// Employee APIs
export const employeeAPI = {
    getAll: (params) => api.get('/employees', { params }),
    getById: (id) => api.get(`/employees/${id}`),
    create: (data) => api.post('/employees', data),
    update: (id, data) => api.put(`/employees/${id}`, data),
    delete: (id) => api.delete(`/employees/${id}`),
    getStats: () => api.get('/employees/stats/summary'),
};

// Leave APIs
export const leaveAPI = {
    getAll: (params) => api.get('/leaves', { params }),
    getPending: () => api.get('/leaves/pending'),
    create: (data) => api.post('/leaves', data),
    approve: (id) => api.put(`/leaves/${id}/approve`),
    reject: (id, reason) => api.put(`/leaves/${id}/reject`, { reason }),
    cancel: (id) => api.put(`/leaves/${id}/cancel`),
    getStats: () => api.get('/leaves/stats'),
};

// Attendance APIs
export const attendanceAPI = {
    getAll: (params) => api.get('/attendance', { params }),
    getToday: () => api.get('/attendance/today'),
    clockIn: (data) => api.post('/attendance/clock-in', data),
    clockOut: (data) => api.post('/attendance/clock-out', data),
    getSummary: (params) => api.get('/attendance/summary', { params }),
    getReport: (id, params) => api.get(`/attendance/report/${id}`, { params }),
};

// Settings APIs
export const settingsAPI = {
    get: () => api.get('/settings'),
    update: (data) => api.put('/settings', data),
    addHoliday: (data) => api.post('/settings/holidays', data),
    removeHoliday: (id) => api.delete(`/settings/holidays/${id}`),
    addDepartment: (name) => api.post('/settings/departments', { name }),
    removeDepartment: (name) => api.delete(`/settings/departments/${name}`),
};

// Performance APIs
export const performanceAPI = {
    getReviews: (params) => api.get('/performance/reviews', { params }),
    getReview: (id) => api.get(`/performance/reviews/${id}`),
    createReview: (data) => api.post('/performance/reviews', data),
    updateReview: (id, data) => api.put(`/performance/reviews/${id}`, data),
    acknowledgeReview: (id, feedback) => api.put(`/performance/reviews/${id}/acknowledge`, { feedback }),
    getGoals: (params) => api.get('/performance/goals', { params }),
    getGoal: (id) => api.get(`/performance/goals/${id}`),
    createGoal: (data) => api.post('/performance/goals', data),
    updateGoal: (id, data) => api.put(`/performance/goals/${id}`, data),
    deleteGoal: (id) => api.delete(`/performance/goals/${id}`),
    addComment: (id, text) => api.post(`/performance/goals/${id}/comments`, { text }),
    getStats: (params) => api.get('/performance/stats', { params }),
};

// Payroll APIs
export const payrollAPI = {
    getAll: (params) => api.get('/payroll', { params }),
    getMyPayslips: () => api.get('/payroll/my-payslips'),
    getById: (id) => api.get(`/payroll/${id}`),
    create: (data) => api.post('/payroll', data),
    generateBatch: (data) => api.post('/payroll/generate-batch', data),
    update: (id, data) => api.put(`/payroll/${id}`, data),
    approve: (id) => api.put(`/payroll/${id}/approve`),
    pay: (id) => api.put(`/payroll/${id}/pay`),
    delete: (id) => api.delete(`/payroll/${id}`),
    getStats: (params) => api.get('/payroll/stats/summary', { params }),
    exportCSV: (params) => api.get('/payroll/export/csv', { params, responseType: 'blob' }),
    downloadSlip: (id) => api.get(`/payroll/${id}/download`, { responseType: 'blob' }),
};

// Onboarding APIs
export const onboardingAPI = {
    getAll: (params) => api.get('/onboarding', { params }),
    getMyOnboarding: () => api.get('/onboarding/my-onboarding'),
    getById: (id) => api.get(`/onboarding/${id}`),
    create: (data) => api.post('/onboarding', data),
    update: (id, data) => api.put(`/onboarding/${id}`, data),
    delete: (id) => api.delete(`/onboarding/${id}`),
    updateTask: (id, taskId, data) => api.put(`/onboarding/${id}/tasks/${taskId}`, data),
    addTask: (id, data) => api.post(`/onboarding/${id}/tasks`, data),
    removeTask: (id, taskId) => api.delete(`/onboarding/${id}/tasks/${taskId}`),
    submitFeedback: (id, data) => api.post(`/onboarding/${id}/feedback`, data),
    getStats: () => api.get('/onboarding/stats/summary'),
    getTemplate: () => api.get('/onboarding/templates/default'),
};

// Recruiting APIs
export const recruitingAPI = {
    // Jobs
    getJobs: (params) => api.get('/recruiting/jobs', { params }),
    getPublicJobs: (params) => api.get('/recruiting/jobs/public', { params }),
    getJob: (id) => api.get(`/recruiting/jobs/${id}`),
    createJob: (data) => api.post('/recruiting/jobs', data),
    updateJob: (id, data) => api.put(`/recruiting/jobs/${id}`, data),
    deleteJob: (id) => api.delete(`/recruiting/jobs/${id}`),
    // Candidates
    getCandidates: (jobId, params) => api.get(`/recruiting/jobs/${jobId}/candidates`, { params }),
    getCandidate: (id) => api.get(`/recruiting/candidates/${id}`),
    applyToJob: (jobId, data) => api.post(`/recruiting/jobs/${jobId}/candidates`, data),
    updateCandidate: (id, data) => api.put(`/recruiting/candidates/${id}`, data),
    updateCandidateStage: (id, stage, reason) => api.put(`/recruiting/candidates/${id}/stage`, { stage, rejectionReason: reason }),
    scheduleInterview: (id, data) => api.post(`/recruiting/candidates/${id}/interviews`, data),
    updateInterview: (id, interviewId, data) => api.put(`/recruiting/candidates/${id}/interviews/${interviewId}`, data),
    addNote: (id, text) => api.post(`/recruiting/candidates/${id}/notes`, { text }),
    updateOffer: (id, data) => api.put(`/recruiting/candidates/${id}/offer`, data),
    deleteCandidate: (id) => api.delete(`/recruiting/candidates/${id}`),
    getStats: () => api.get('/recruiting/stats'),
};

// Documents APIs
export const documentsAPI = {
    getAll: (params) => api.get('/documents', { params }),
    getMyDocuments: () => api.get('/documents/my-documents'),
    getById: (id) => api.get(`/documents/${id}`),
    getExpiring: (days) => api.get('/documents/expiring', { params: { days } }),
    getStats: () => api.get('/documents/stats'),
    upload: (formData) => api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    update: (id, data) => api.put(`/documents/${id}`, data),
    verify: (id) => api.put(`/documents/${id}/verify`),
    unverify: (id) => api.put(`/documents/${id}/unverify`),
    delete: (id) => api.delete(`/documents/${id}`),
    permanentDelete: (id) => api.delete(`/documents/${id}/permanent`),
    download: (id) => api.get(`/documents/${id}/download`, { responseType: 'blob' }),
};

// Announcement APIs
export const announcementAPI = {
    getAll: (params) => api.get('/announcements', { params }),
    getLatest: (limit = 5) => api.get('/announcements/latest', { params: { limit } }),
    getById: (id) => api.get(`/announcements/${id}`),
    create: (data) => api.post('/announcements', data),
    update: (id, data) => api.put(`/announcements/${id}`, data),
    delete: (id) => api.delete(`/announcements/${id}`),
    togglePin: (id) => api.put(`/announcements/${id}/pin`),
};

// Task APIs
export const taskAPI = {
    getAll: (params) => api.get('/tasks', { params }),
    getMy: () => api.get('/tasks/my'),
    getById: (id) => api.get(`/tasks/${id}`),
    create: (data) => api.post('/tasks', data),
    createBulk: (data) => api.post('/tasks/bulk', data),
    update: (id, data) => api.put(`/tasks/${id}`, data),
    updateStatus: (id, data) => api.put(`/tasks/${id}/status`, data),
    delete: (id) => api.delete(`/tasks/${id}`),
    getStats: () => api.get('/tasks/stats/overview'),
};

// Certificate Generation APIs
export const certificateAPI = {
    generate: (data) => api.post('/generate-certificate', data, { responseType: 'blob' }),
};

// OKR / KPI APIs
export const okrAPI = {
    // OKR
    getAll: (params) => api.get('/okr', { params }),
    getById: (id) => api.get(`/okr/${id}`),
    create: (data) => api.post('/okr', data),
    update: (id, data) => api.put(`/okr/${id}`, data),
    updateKeyResult: (id, krIndex, data) => api.put(`/okr/${id}/key-results/${krIndex}`, data),
    delete: (id) => api.delete(`/okr/${id}`),
    getStats: (params) => api.get('/okr/stats', { params }),
    // KPI
    getKPIs: (params) => api.get('/okr/kpis', { params }),
    createKPI: (data) => api.post('/okr/kpis', data),
    updateKPI: (id, data) => api.put(`/okr/kpis/${id}`, data),
    addKPIEntry: (id, data) => api.post(`/okr/kpis/${id}/entries`, data),
    deleteKPI: (id) => api.delete(`/okr/kpis/${id}`),
};

// Notification APIs
export const notificationAPI = {
    getAll: (params) => api.get('/notifications', { params }),
    getUnreadCount: () => api.get('/notifications/unread-count'),
    markAsRead: (id) => api.put(`/notifications/${id}/read`),
    markAllAsRead: () => api.put('/notifications/read-all'),
    delete: (id) => api.delete(`/notifications/${id}`),
};

export default api;

