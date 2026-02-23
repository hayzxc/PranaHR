/**
 * Error Handling Middleware
 * Centralized error handling for the application
 */

const { AppError, ValidationError, InternalError } = require('../utils/errors');

/**
 * Development error response
 * Shows full error details including stack trace
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    code: err.code,
    message: err.message,
    errors: err.errors || undefined,
    stack: err.stack,
    error: err,
  });
};

/**
 * Production error response
 * Hides implementation details
 */
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      status: err.status,
      code: err.code,
      message: err.message,
      errors: err.errors || undefined,
    });
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥:', err);
    res.status(500).json({
      success: false,
      status: 'error',
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
};

/**
 * Handle Mongoose CastError (invalid ObjectId)
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400, 'INVALID_ID');
};

/**
 * Handle Mongoose Duplicate Key Error
 */
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `Duplicate field value: ${field} = "${value}". Please use another value.`;
  return new AppError(message, 409, 'DUPLICATE_FIELD');
};

/**
 * Handle Mongoose Validation Error
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => ({
    field: el.path,
    message: el.message,
    value: el.value,
  }));
  return new ValidationError('Validation failed', errors);
};

/**
 * Handle JWT Error
 */
const handleJWTError = () =>
  new AppError('Invalid token. Please log in again.', 401, 'INVALID_TOKEN');

/**
 * Handle JWT Expired Error
 */
const handleJWTExpiredError = () =>
  new AppError('Your token has expired. Please log in again.', 401, 'TOKEN_EXPIRED');

/**
 * Handle Multer File Size Error
 */
const handleMulterError = (err) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return new AppError('File too large. Maximum size is 10MB.', 400, 'FILE_TOO_LARGE');
  }
  if (err.code === 'LIMIT_FILE_COUNT') {
    return new AppError('Too many files. Maximum is 5 files.', 400, 'TOO_MANY_FILES');
  }
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return new AppError('Unexpected file field.', 400, 'UNEXPECTED_FILE');
  }
  return new AppError(err.message, 400, 'FILE_ERROR');
};

/**
 * Global Error Handler
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;
    error.stack = err.stack;

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {error = handleCastErrorDB(err);}

    // Mongoose duplicate key
    if (err.code === 11000) {error = handleDuplicateFieldsDB(err);}

    // Mongoose validation error
    if (err.name === 'ValidationError' && err.errors) {error = handleValidationErrorDB(err);}

    // JWT errors
    if (err.name === 'JsonWebTokenError') {error = handleJWTError();}
    if (err.name === 'TokenExpiredError') {error = handleJWTExpiredError();}

    // Multer errors
    if (err.name === 'MulterError') {error = handleMulterError(err);}

    sendErrorProd(error, res);
  }
};

/**
 * 404 Not Found Handler
 */
const notFoundHandler = (req, res, next) => {
  const err = new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND');
  next(err);
};

/**
 * Async Error Catcher
 * Use this to wrap async route handlers
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  errorHandler,
  notFoundHandler,
  catchAsync,
};
