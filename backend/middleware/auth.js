/**
 * Authentication & Authorization Middleware
 * Type-safe JWT verification and role-based access control
 * PONYTAIL FIX: Prisma Integration
 */

const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma').default;
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * Verify JWT token and attach user to request
 */
const auth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Access denied. No token provided.');
    }

    const token = authHeader.replace('Bearer ', '');

    if (!token) {
      throw new UnauthorizedError('Access denied. No token provided.');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true } // Exclude password
    });

    if (!user) {
      throw new UnauthorizedError('User not found.');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User account is deactivated.');
    }

    req.user = user;
    req.token = token;
    req.userId = user.id;

    next();
  } catch (error) {
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
 * Optional auth
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, role: true, isActive: true }
    });

    if (user && user.isActive) {
      req.user = user;
      req.token = token;
      req.userId = user.id;
    }

    next();
  } catch (error) {
    next();
  }
};

/**
 * Check if user owns the resource or has admin/hr role
 */
const authorizeOwnerOrAdmin = (ownerField = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Not authenticated.'));
    }

    if (['admin', 'hr'].includes(req.user.role)) {
      return next();
    }

    if (req.resource && req.resource[ownerField]) {
      const ownerId = req.resource[ownerField].toString();
      const userId = req.user.id.toString();

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
