/**
 * Response Helpers for consistent API responses
 * Provides type-safe response formatting
 */

/**
 * Success response
 * @param {Object} res - Express response object
 * @param {Object} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 */
const success = (res, data = null, message = 'Success', statusCode = 200) => {
  const response = {
    success: true,
    message,
    ...(data !== null && { data }),
  };
  return res.status(statusCode).json(response);
};

/**
 * Created response
 * @param {Object} res - Express response object
 * @param {Object} data - Created resource data
 * @param {string} message - Success message
 */
const created = (res, data, message = 'Resource created successfully') => {
  return success(res, data, message, 201);
};

/**
 * Paginated response
 * @param {Object} res - Express response object
 * @param {Array} items - Array of items
 * @param {Object} pagination - Pagination info
 * @param {string} message - Success message
 */
const paginated = (res, items, pagination, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data: items,
    pagination: {
      total: pagination.total,
      page: pagination.page,
      limit: pagination.limit,
      pages: Math.ceil(pagination.total / pagination.limit),
      hasMore: pagination.page < Math.ceil(pagination.total / pagination.limit),
    },
  });
};

/**
 * Error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @param {Array} errors - Validation errors
 */
const error = (res, message = 'Error', statusCode = 500, code = null, errors = null) => {
  const response = {
    success: false,
    message,
    ...(code && { code }),
    ...(errors && { errors }),
  };
  return res.status(statusCode).json(response);
};

/**
 * No content response
 * @param {Object} res - Express response object
 */
const noContent = (res) => {
  return res.status(204).send();
};

module.exports = {
  success,
  created,
  paginated,
  error,
  noContent,
};
