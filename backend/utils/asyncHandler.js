/**
 * Async Handler Wrapper
 * Wraps async route handlers to automatically catch errors
 * and pass them to the error middleware
 */

/**
 * Wraps an async function to handle try/catch automatically
 * @param {Function} fn - Async route handler function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Wraps a controller method with try/catch
 * Useful for class-based controllers
 * @param {Function} fn - Async controller method
 * @returns {Function} Express middleware function
 */
const tryCatch = (fn) => {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
};

module.exports = { asyncHandler, tryCatch };
