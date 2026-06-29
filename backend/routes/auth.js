/**
 * Authentication Routes
 * Type-safe authentication with JWT
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma').default;
const { auth } = require('../middleware/auth');
const {
  registerValidation,
  loginValidation,
  changePasswordValidation,
} = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created } = require('../utils/response');
const {
  UnauthorizedError,
  ConflictError,
  BadRequestError,
} = require('../utils/errors');

const router = express.Router();

/**
 * Generate JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user.id, type: 'refresh', tokenVersion: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: '30d' },
  );
};

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', registerValidation, catchAsync(async (req, res) => {
  const { email, password, role, name, department, position, salary } = req.body;

  const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existingUser) {
    throw new ConflictError('User already exists with this email');
  }

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  let userRole = role || 'employee';

  // Security enhancement: Prevent public registration of admin or HR roles unless bootstrapping or in tests.
  if (userRole !== 'employee' && process.env.NODE_ENV !== 'test' && process.env.ALLOW_ADMIN_REGISTRATION !== 'true') {
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      userRole = 'employee';
    }
  }

  let employeeData = undefined;
  if (userRole !== 'admin') {
    // Basic atomic counter workaround for Postgres sequence
    // In production, we would use a sequence, but for simplicity here we count
    const count = await prisma.employee.count();
    const employeeId = `EMP${String(count + 1).padStart(5, '0')}`;

    employeeData = {
      create: {
        employeeId,
        name: name || email.split('@')[0],
        email: email.toLowerCase(),
        department: department || 'Teknis dan IT',
        position: position || 'Employee',
        salary: salary || 0,
        hireDate: new Date(),
      }
    };
  }

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      role: userRole,
      employee: employeeData,
    },
    include: {
      employee: true,
    }
  });

  const { password: _, ...userWithoutPassword } = user;

  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  created(res, {
    token,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    user: userWithoutPassword,
    employee: user.employee,
  }, 'User registered successfully');
}));

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidation, catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
    include: { employee: true }
  });

  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated. Please contact administrator.');
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid credentials');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() }
  });

  const { password: _, ...userWithoutPassword } = user;

  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  success(res, {
    token,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    user: userWithoutPassword,
    employee: user.employee,
  }, 'Login successful');
}));

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', auth, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });

  success(res, {
    user: req.user,
    employee,
  });
}));

// @route   POST /api/auth/refresh
// @desc    Refresh access token
// @access  Public
router.post('/refresh', catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new BadRequestError('Refresh token is required');
  }

  const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

  if (decoded.type !== 'refresh') {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.id } });

  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or inactive');
  }

  if (decoded.tokenVersion !== (user.tokenVersion || 0)) {
    throw new UnauthorizedError('Refresh token has been revoked');
  }

  const newToken = generateToken(user);
  const newRefreshToken = generateRefreshToken(user);

  success(res, {
    token: newToken,
    refreshToken: newRefreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  }, 'Token refreshed successfully');
}));

// @route   POST /api/auth/change-password
// @desc    Change user password
// @access  Private
router.post('/change-password', auth, changePasswordValidation, catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await prisma.user.findUnique({ where: { id: req.user.id } });

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(newPassword, salt);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      tokenVersion: { increment: 1 },
      passwordChangedAt: new Date()
    }
  });

  const token = generateToken(user);

  success(res, { token }, 'Password changed successfully');
}));

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', auth, catchAsync(async (req, res) => {
  await prisma.user.update({
    where: { id: req.user.id },
    data: { tokenVersion: { increment: 1 } }
  });
  success(res, null, 'Logged out successfully');
}));

// @route   GET /api/auth/verify
// @desc    Verify token is valid
// @access  Private
router.get('/verify', auth, catchAsync(async (req, res) => {
  success(res, {
    valid: true,
    user: req.user,
  }, 'Token is valid');
}));

module.exports = router;
