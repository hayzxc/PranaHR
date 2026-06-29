/**
 * Enhanced Validation Schemas
 * Type-safe validation with express-validator
 */

const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

// ============================================
// VALIDATION RESULT HANDLER
// ============================================

/**
 * Middleware to handle validation results
 * Throws ValidationError if validation fails
 */
const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map(err => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));
    throw new ValidationError('Validation failed', formattedErrors);
  }
  next();
};

// ============================================
// COMMON VALIDATORS
// ============================================

const checkUuidOrMongoId = value => {
  if (!value) return true;
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  const isMongo = /^[0-9a-fA-F]{24}$/.test(value);
  if (!isUuid && !isMongo) {
    throw new Error('Invalid ID format');
  }
  return true;
};

const isMongoId = (field, location = 'params') => {
  const validator = location === 'params' ? param(field) : body(field);
  return validator.custom(checkUuidOrMongoId).withMessage(`Invalid ${field} format`);
};

const isEmail = (field = 'email') =>
  body(field).isEmail().normalizeEmail().withMessage('Valid email is required');

const isPassword = (field = 'password', minLength = 6) =>
  body(field)
    .isLength({ min: minLength })
    .withMessage(`Password must be at least ${minLength} characters`)
    .matches(/\d/)
    .withMessage('Password must contain a number');

const isPasswordOptional = (field = 'password', minLength = 6) =>
  body(field)
    .optional()
    .isLength({ min: minLength })
    .withMessage(`Password must be at least ${minLength} characters`);

const isString = (field, { min = 1, max = 500, required = true } = {}) => {
  let validator = body(field);
  if (!required) { validator = validator.optional({ values: 'falsy' }); }
  return validator
    .trim()
    .isLength({ min, max })
    .withMessage(`${field} must be between ${min} and ${max} characters`);
};

const isNumber = (field, { min = 0, max = Infinity, required = true } = {}) => {
  let validator = body(field);
  if (!required) { validator = validator.optional(); }
  return validator
    .isNumeric()
    .withMessage(`${field} must be a number`)
    .toFloat()
    .custom(value => value >= min && value <= max)
    .withMessage(`${field} must be between ${min} and ${max}`);
};

const isDate = (field, { required = true } = {}) => {
  let validator = body(field);
  if (!required) { validator = validator.optional(); }
  return validator.isISO8601().withMessage(`${field} must be a valid date`);
};

const isEnum = (field, values, { required = true } = {}) => {
  let validator = body(field);
  if (!required) { validator = validator.optional(); }
  return validator.isIn(values).withMessage(`${field} must be one of: ${values.join(', ')}`);
};

const isBoolean = (field, { required = true } = {}) => {
  let validator = body(field);
  if (!required) { validator = validator.optional(); }
  return validator.isBoolean().withMessage(`${field} must be a boolean`);
};

const isArray = (field, { minLength = 0, maxLength = 100, required = true } = {}) => {
  let validator = body(field);
  if (!required) { validator = validator.optional(); }
  return validator
    .isArray({ min: minLength, max: maxLength })
    .withMessage(`${field} must be an array with ${minLength}-${maxLength} items`);
};

// ============================================
// AUTH VALIDATIONS
// ============================================

const registerValidation = [
  isEmail(),
  isPassword(),
  isEnum('role', ['admin', 'hr', 'employee'], { required: false }),
  handleValidation,
];

const loginValidation = [
  isEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidation,
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  isPassword('newPassword'),
  handleValidation,
];

// ============================================
// EMPLOYEE VALIDATIONS
// ============================================

const DEPARTMENTS = ['Sertifikasi', 'Finance', 'Admin/CS', 'Verifikasi', 'Teknis dan IT'];
const EMPLOYEE_STATUS = ['active', 'inactive', 'on-leave', 'terminated'];
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'];

const employeeCreateValidation = [
  isString('name', { min: 2, max: 100 }),
  isEmail(),
  isEnum('department', DEPARTMENTS),
  isString('position', { min: 2, max: 100 }),
  isNumber('salary', { min: 0, max: 10000000 }),
  isDate('hireDate', { required: false }),
  isString('phone', { min: 5, max: 20, required: false }),
  isString('address', { min: 5, max: 500, required: false }),
  isPasswordOptional(),
  isEnum('role', ['admin', 'hr', 'employee'], { required: false }),
  handleValidation,
];

const employeeUpdateValidation = [
  isString('name', { min: 2, max: 100, required: false }),
  body('email').optional().isEmail().normalizeEmail().withMessage('Valid email is required'),
  isEnum('department', DEPARTMENTS, { required: false }),
  isString('position', { min: 2, max: 100, required: false }),
  isNumber('salary', { min: 0, max: 10000000, required: false }),
  isEnum('status', EMPLOYEE_STATUS, { required: false }),
  isDate('hireDate', { required: false }),
  isString('phone', { min: 5, max: 20, required: false }),
  isString('address', { min: 5, max: 500, required: false }),
  handleValidation,
];

// ============================================
// LEAVE VALIDATIONS
// ============================================

const LEAVE_TYPES = ['annual', 'sick', 'personal', 'maternity', 'paternity', 'unpaid', 'other'];
const LEAVE_STATUS = ['pending', 'approved', 'rejected', 'cancelled'];

const leaveCreateValidation = [
  isEnum('type', LEAVE_TYPES),
  isDate('startDate'),
  isDate('endDate'),
  isString('reason', { min: 5, max: 1000 }),
  handleValidation,
];

const leaveUpdateValidation = [
  isEnum('status', LEAVE_STATUS),
  isString('reviewNotes', { min: 1, max: 1000, required: false }),
  handleValidation,
];

// ============================================
// ATTENDANCE VALIDATIONS
// ============================================

const ATTENDANCE_STATUS = ['present', 'absent', 'late', 'half_day', 'on_leave'];

const attendanceValidation = [
  isDate('date', { required: false }),
  isString('notes', { min: 1, max: 500, required: false }),
  body('location').optional().isObject().withMessage('Location must be an object'),
  handleValidation,
];

const attendanceUpdateValidation = [
  isEnum('status', ATTENDANCE_STATUS, { required: false }),
  isDate('clockIn', { required: false }),
  isDate('clockOut', { required: false }),
  isString('notes', { min: 1, max: 500, required: false }),
  handleValidation,
];

// ============================================
// PAYROLL VALIDATIONS
// ============================================

const PAYROLL_STATUS = ['pending', 'processing', 'paid', 'failed'];

const payrollValidation = [
  isMongoId('employeeId', 'body'),
  isNumber('baseSalary', { min: 0 }),
  isNumber('allowances', { min: 0, required: false }),
  isNumber('deductions', { min: 0, required: false }),
  isNumber('bonus', { min: 0, required: false }),
  isDate('payPeriodStart'),
  isDate('payPeriodEnd'),
  handleValidation,
];

// ============================================
// PERFORMANCE VALIDATIONS
// ============================================

const performanceValidation = [
  isMongoId('employeeId', 'body'),
  isString('reviewPeriod', { min: 2, max: 50 }),
  isNumber('rating', { min: 1, max: 5 }),
  isString('strengths', { min: 5, max: 2000, required: false }),
  isString('improvements', { min: 5, max: 2000, required: false }),
  isString('goals', { min: 5, max: 2000, required: false }),
  isString('comments', { min: 5, max: 2000, required: false }),
  handleValidation,
];

// ============================================
// OKR VALIDATIONS
// ============================================

const OKR_CYCLES = ['Q1', 'Q2', 'Q3', 'Q4', 'H1', 'H2', 'Annual'];
const OKR_STATUS = ['draft', 'active', 'completed', 'cancelled'];
const OKR_CATEGORIES = ['individual', 'team', 'department', 'company'];
const KPI_FREQUENCIES = ['daily', 'weekly', 'monthly', 'quarterly', 'annually'];
const KPI_CATEGORIES = ['productivity', 'quality', 'efficiency', 'engagement', 'financial', 'customer', 'custom'];

const okrCreateValidation = [
  isString('title', { min: 3, max: 200 }),
  isString('description', { min: 0, max: 1000, required: false }),
  isEnum('cycle', OKR_CYCLES),
  isNumber('year', { min: 2020, max: 2100 }),
  isEnum('category', OKR_CATEGORIES, { required: false }),
  isArray('keyResults', { minLength: 1, maxLength: 10 }),
  body('keyResults.*.title').trim().isLength({ min: 3, max: 200 }).withMessage('Key result title must be 3-200 chars'),
  body('keyResults.*.targetValue').isNumeric().withMessage('Target value must be a number'),
  body('keyResults.*.unit').optional().trim().isLength({ max: 50 }).withMessage('Unit max 50 chars'),
  body('keyResults.*.weight').optional().isFloat({ min: 0.1, max: 10 }).withMessage('Weight must be 0.1-10'),
  body('parentObjective').optional().custom(checkUuidOrMongoId).withMessage('Invalid parent objective ID'),
  handleValidation,
];

const okrUpdateValidation = [
  isString('title', { min: 3, max: 200, required: false }),
  isString('description', { min: 0, max: 1000, required: false }),
  isEnum('cycle', OKR_CYCLES, { required: false }),
  isNumber('year', { min: 2020, max: 2100, required: false }),
  isEnum('category', OKR_CATEGORIES, { required: false }),
  isEnum('status', OKR_STATUS, { required: false }),
  body('keyResults').optional().isArray({ min: 1, max: 10 }).withMessage('Key results must be 1-10 items'),
  handleValidation,
];

const kpiCreateValidation = [
  isString('name', { min: 2, max: 200 }),
  isString('description', { min: 0, max: 1000, required: false }),
  isString('unit', { min: 1, max: 50 }),
  isNumber('targetValue', { min: 0 }),
  isEnum('frequency', KPI_FREQUENCIES, { required: false }),
  isEnum('category', KPI_CATEGORIES, { required: false }),
  isEnum('department', DEPARTMENTS, { required: false }),
  body('employeeId').optional().custom(checkUuidOrMongoId).withMessage('Invalid employee ID'),
  handleValidation,
];

const kpiEntryValidation = [
  body('value').isNumeric().withMessage('Value must be a number'),
  isDate('date', { required: false }),
  isString('notes', { min: 0, max: 500, required: false }),
  handleValidation,
];

// ============================================
// DOCUMENT VALIDATIONS
// ============================================

const DOCUMENT_TYPES = ['contract', 'id', 'certificate', 'policy', 'payslip', 'other'];
const DOCUMENT_ACCESS = ['private', 'public', 'hr_only', 'managers'];

const documentValidation = [
  isString('title', { min: 2, max: 200 }),
  isEnum('type', DOCUMENT_TYPES, { required: false }),
  isString('description', { min: 0, max: 1000, required: false }),
  isEnum('accessLevel', DOCUMENT_ACCESS, { required: false }),
  handleValidation,
];

// ============================================
// RECRUITING VALIDATIONS
// ============================================

const JOB_STATUS = ['open', 'closed', 'on_hold', 'filled'];
const APPLICATION_STATUS = ['applied', 'screening', 'interview', 'offer', 'hired', 'rejected'];

const jobPostingValidation = [
  isString('title', { min: 5, max: 200 }),
  isEnum('department', DEPARTMENTS),
  isString('description', { min: 50, max: 5000 }),
  isString('requirements', { min: 20, max: 3000 }),
  isNumber('salaryMin', { min: 0, required: false }),
  isNumber('salaryMax', { min: 0, required: false }),
  isString('location', { min: 2, max: 100, required: false }),
  isEnum('employmentType', EMPLOYMENT_TYPES, { required: false }),
  handleValidation,
];

const applicationValidation = [
  isMongoId('jobId', 'body'),
  isString('applicantName', { min: 2, max: 100 }),
  isEmail('applicantEmail'),
  isString('phone', { min: 5, max: 20, required: false }),
  isString('coverLetter', { min: 50, max: 5000, required: false }),
  handleValidation,
];

// ============================================
// ONBOARDING VALIDATIONS
// ============================================

const TASK_STATUS = ['pending', 'in_progress', 'completed', 'skipped'];

const onboardingTaskValidation = [
  isString('title', { min: 3, max: 200 }),
  isString('description', { min: 5, max: 1000, required: false }),
  isNumber('order', { min: 0, max: 100, required: false }),
  isBoolean('required', { required: false }),
  isDate('dueDate', { required: false }),
  handleValidation,
];

// ============================================
// SETTINGS VALIDATIONS
// ============================================

const settingsValidation = [
  isString('companyName', { min: 2, max: 200, required: false }),
  isString('companyEmail', { min: 5, max: 100, required: false }),
  body('workSchedule').optional({ values: 'null' }).isObject().withMessage('Work schedule must be an object'),
  body('leavePolicy').optional({ values: 'null' }).isObject().withMessage('Leave policy must be an object'),
  body('payrollSettings').optional({ values: 'null' }).isObject().withMessage('Payroll settings must be an object'),
  body('notifications').optional({ values: 'null' }).isObject().withMessage('Notifications must be an object'),
  handleValidation,
];

// ============================================
// QUERY VALIDATIONS
// ============================================

const paginationValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .toInt()
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .toInt()
    .withMessage('Limit must be between 1 and 1000'),
  query('sort')
    .optional()
    .isIn(['asc', 'desc', '-1', '1'])
    .withMessage('Sort must be asc or desc'),
  handleValidation,
];

const searchValidation = [
  query('search')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Search query too long'),
  query('department')
    .optional()
    .isIn(DEPARTMENTS)
    .withMessage('Invalid department'),
  query('status')
    .optional()
    .isIn([...EMPLOYEE_STATUS, ...LEAVE_STATUS, ...JOB_STATUS])
    .withMessage('Invalid status'),
  ...paginationValidation,
];

// ============================================
// ID VALIDATIONS
// ============================================

const idValidation = [
  isMongoId('id'),
  handleValidation,
];

// ============================================
// DOCUMENT CATEGORIES (for documents route)
// ============================================

const DOCUMENT_CATEGORIES = ['personal', 'identification', 'education', 'employment', 'financial', 'legal', 'medical', 'certification', 'other'];

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Handler
  handleValidation,

  // Common validators
  isMongoId,
  isEmail,
  isPassword,
  isString,
  isNumber,
  isDate,
  isEnum,
  isBoolean,
  isArray,

  // Auth
  registerValidation,
  loginValidation,
  changePasswordValidation,

  // Employee
  employeeCreateValidation,
  employeeUpdateValidation,
  employeeValidation: employeeCreateValidation, // backward compatibility

  // Leave
  leaveCreateValidation,
  leaveUpdateValidation,
  leaveValidation: leaveCreateValidation, // backward compatibility

  // Attendance
  attendanceValidation,
  attendanceUpdateValidation,

  // Payroll
  payrollValidation,

  // Performance
  performanceValidation,

  // OKR/KPI
  okrCreateValidation,
  okrUpdateValidation,
  kpiCreateValidation,
  kpiEntryValidation,

  // Documents
  documentValidation,

  // Recruiting
  jobPostingValidation,
  applicationValidation,
  jobValidation: jobPostingValidation, // alias
  candidateValidation: applicationValidation, // alias

  // Onboarding
  onboardingTaskValidation,

  // Settings
  settingsValidation,

  // Query
  paginationValidation,
  searchValidation,

  // ID
  idValidation,

  // Constants (for reuse)
  DEPARTMENTS,
  EMPLOYEE_STATUS,
  EMPLOYMENT_TYPES,
  LEAVE_TYPES,
  LEAVE_STATUS,
  ATTENDANCE_STATUS,
  PAYROLL_STATUS,
  DOCUMENT_TYPES,
  DOCUMENT_ACCESS,
  DOCUMENT_CATEGORIES,
  JOB_STATUS,
  APPLICATION_STATUS,
  TASK_STATUS,
  OKR_CYCLES,
  OKR_STATUS,
  OKR_CATEGORIES,
  KPI_FREQUENCIES,
  KPI_CATEGORIES,
};
