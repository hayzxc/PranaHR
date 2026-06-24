const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();
const path = require('path');

const connectDB = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Register models that are accessed via mongoose.model() in pre-save hooks
require('./models/Counter');

// Import routes
const authRoutes = require('./routes/auth');
const employeeRoutes = require('./routes/employees');
const leaveRoutes = require('./routes/leaves');
const attendanceRoutes = require('./routes/attendance');
const settingsRoutes = require('./routes/settings');
const performanceRoutes = require('./routes/performance');
const payrollRoutes = require('./routes/payroll');
const onboardingRoutes = require('./routes/onboarding');
const recruitingRoutes = require('./routes/recruiting');
const documentsRoutes = require('./routes/documents');
const announcementsRoutes = require('./routes/announcements');
const tasksRoutes = require('./routes/tasks');
const notificationsRoutes = require('./routes/notifications');
const generateCertificateRoutes = require('./routes/generate-certificate');
const okrRoutes = require('./routes/okr');

const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Connect to MongoDB
connectDB();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    code: 'RATE_LIMIT',
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Stricter limits for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // 10 login attempts per 15 minutes
  message: {
    success: false,
    code: 'AUTH_RATE_LIMIT',
    message: 'Too many login attempts, please try again later.',
  },
});

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://localhost:4173', // Vite preview server
  'http://localhost:3000',
  'http://127.0.0.1:5173', // Added for local development
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) { return callback(null, true); }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Body parser with conservative limits (increase per-route for uploads)
app.use(express.json({
  limit: '1mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  maxAge: '1d',
  etag: true,
}));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.originalUrl} ${res.statusCode} - ${duration}ms`);
    });
    next();
  });
}

// API Routes — authLimiter applied ONLY to login/register, not /me, /refresh, /verify, /logout
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/recruiting', recruitingRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/generate-certificate', generateCertificateRoutes);
app.use('/api/okr', okrRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Sobat HR API Server',
    version: '1.0.0',
    docs: '/api/health',
  });
});

// 404 handler - must be after all routes
app.use(notFoundHandler);

// Global error handler - must be last
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  process.exit(1);
});

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════╗
  ║     Sobat HR Backend Server            ║
  ╠════════════════════════════════════════╣
  ║  Status: Running ✓                     ║
  ║  Port: ${PORT}                            ║
  ║  Mode: ${(process.env.NODE_ENV || 'development').padEnd(26)}║
  ║  Type-Safe: Enabled                    ║
  ╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM RECEIVED. Shutting down gracefully');
  server.close(() => {
    console.log('💤 Process terminated!');
  });
});

module.exports = app;
