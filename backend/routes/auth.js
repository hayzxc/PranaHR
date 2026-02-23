/**
 * Authentication Routes
 * Type-safe authentication with JWT
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Employee = require('../models/Employee');
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
 * @param {Object} user - User document
 * @returns {string} JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
  );
};

/**
 * Generate refresh token
 * @param {Object} user - User document  
 * @returns {string} Refresh token
 */
const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id, type: 'refresh' },
    process.env.JWT_SECRET,
    { expiresIn: '30d' },
  );
};

// @route   POST /api/auth/register
// @desc    Register new user
// @access  Public
router.post('/register', registerValidation, catchAsync(async (req, res) => {
  const { email, password, role, name, department, position, salary } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ConflictError('User already exists with this email');
  }

  // Create user
  const user = new User({
    email: email.toLowerCase(),
    password,
    role: role || 'employee',
  });
  await user.save();

  // Create employee profile if registering as employee or hr
  let employee = null;
  if (role !== 'admin') {
    // Generate employee ID
    const count = await Employee.countDocuments();
    const employeeId = `EMP${String(count + 1).padStart(5, '0')}`;

    employee = new Employee({
      userId: user._id,
      employeeId,
      name: name || email.split('@')[0],
      email: email.toLowerCase(),
      department: department || 'IT',
      position: position || 'Employee',
      salary: salary || 0,
      hireDate: new Date(),
    });
    await employee.save();
  }

  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  created(res, {
    token,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    user: user.toJSON(),
    employee,
  }, 'User registered successfully');
}));

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginValidation, catchAsync(async (req, res) => {
  const { email, password } = req.body;

  // Find user with password
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Check if active
  if (!user.isActive) {
    throw new UnauthorizedError('Account is deactivated. Please contact administrator.');
  }

  // Verify password
  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // Update last login
  user.lastLogin = new Date();
  await user.save();

  // Get employee profile if exists
  const employee = await Employee.findOne({ userId: user._id }).lean();

  const token = generateToken(user);
  const refreshToken = generateRefreshToken(user);

  success(res, {
    token,
    refreshToken,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    user: user.toJSON(),
    employee,
  }, 'Login successful');
}));

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', auth, catchAsync(async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user._id }).lean();

  success(res, {
    user: req.user.toJSON(),
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

  // Verify refresh token
  const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);

  if (decoded.type !== 'refresh') {
    throw new UnauthorizedError('Invalid refresh token');
  }

  // Find user
  const user = await User.findById(decoded.id);

  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or inactive');
  }

  // Generate new tokens
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

  // Get user with password
  const user = await User.findById(req.user._id).select('+password');

  // Verify current password
  const isMatch = await user.comparePassword(currentPassword);
  if (!isMatch) {
    throw new UnauthorizedError('Current password is incorrect');
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Generate new token
  const token = generateToken(user);

  success(res, { token }, 'Password changed successfully');
}));

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', auth, catchAsync(async (req, res) => {
  // In a stateless JWT setup, logout is handled client-side
  // This endpoint can be used for logging or token blacklisting in the future
  success(res, null, 'Logged out successfully');
}));

// @route   GET /api/auth/verify
// @desc    Verify token is valid
// @access  Private
router.get('/verify', auth, catchAsync(async (req, res) => {
  success(res, {
    valid: true,
    user: req.user.toJSON(),
  }, 'Token is valid');
}));

module.exports = router;
