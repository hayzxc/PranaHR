/**
 * Authentication & Authorization Middleware
 * Type-safe JWT verification and role-based access control
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * Verify JWT token and attach user to request
 * @throws {UnauthorizedError} If token is missing, invalid, or expired
 */
const auth = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access denied. No token provided.');
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedError('Access denied. No token provided.');
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find user
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      throw new UnauthorizedError('User not found.');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account is deactivated.');
    }

    // Attach user and token to request
    req.user = user;
    req.token = token;
    req.userId = user._id;

    next();
  } catch (error) {
    // Pass to error handler
    if (error.name === 'JsonWebTokenError') {
      return next(new UnauthorizedError('Invalid token.'));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new UnauthorizedError('Token has expired. Please log in again.'));
    }
    next(error);
  }
};

/**
 * Check if user has required role(s)
 * @param {...string} roles - Allowed roles
 * @throws {ForbiddenError} If user doesn't have required role
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated.'));
    }

    if (!roles.includes(req.user.role)) {
      return next(new ForbiddenError(
        `Access denied. Required role: ${roles.join(' or ')}.`,
      ));
    }

    next();
  };
};

/**
 * Optional auth - attaches user if token exists, but doesn't require it
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');

    if (user && user.isActive) {
      req.user = user;
      req.token = token;
      req.userId = user._id;
    }

    next();
  } catch (error) {
    // Silently continue without user for optional auth
    next();
  }
};

/**
 * Check if user owns the resource or has admin/hr role
 * @param {string} ownerField - Field name containing owner ID
 */
const authorizeOwnerOrAdmin = (ownerField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated.'));
    }

    // Admin and HR can access anything
    if (['admin', 'hr'].includes(req.user.role)) {
      return next();
    }

    // Check if resource exists and user owns it
    if (req.resource && req.resource[ownerField]) {
      const ownerId = req.resource[ownerField].toString();
      const userId = req.user._id.toString();

      if (ownerId === userId) {
        return next();
      }
    }

    next(new ForbiddenError('Access denied. You can only access your own resources.'));
  };
};

module.exports = {
  auth,
  authorize,
  optionalAuth,
  authorizeOwnerOrAdmin,
};
