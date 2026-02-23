const express = require('express');
const Employee = require('../models/Employee');
const User = require('../models/User');
const { auth, authorize } = require('../middleware/auth');
const {
  employeeCreateValidation,
  employeeUpdateValidation,
  idValidation,
  searchValidation,
  DEPARTMENTS,
} = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created, paginated } = require('../utils/response');
const { NotFoundError, ConflictError, ForbiddenError } = require('../utils/errors');

const router = express.Router();

// @route   GET /api/employees/stats/summary
// @desc    Get employee statistics
// @access  Private (HR, Admin)
// NOTE: This route must be before /:id to avoid conflict
router.get('/stats/summary', auth, authorize('hr', 'admin'), catchAsync(async (req, res) => {
  const stats = await Employee.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$department',
        count: { $sum: 1 },
        avgSalary: { $avg: '$salary' },
      },
    },
    { $sort: { count: -1 } },
  ]);

  const totalEmployees = await Employee.countDocuments({ status: 'active' });
  const departments = await Employee.distinct('department');

  success(res, {
    totalEmployees,
    departments: departments.length,
    byDepartment: stats,
  });
}));

// @route   GET /api/employees
// @desc    Get all employees with filtering and pagination
// @access  Private (HR, Admin)
router.get('/', auth, authorize('hr', 'admin'), searchValidation, catchAsync(async (req, res) => {
  const {
    department,
    status,
    search,
    page = 1,
    limit = 10,
    sort = 'createdAt',
    order = 'desc',
  } = req.query;

  // Build query
  const query = {};

  if (department && DEPARTMENTS.includes(department)) {
    query.department = department;
  }

  if (status) {
    query.status = status;
  }

  if (search) {
    const searchRegex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    query.$or = [
      { name: searchRegex },
      { email: searchRegex },
      { employeeId: searchRegex },
      { position: searchRegex },
    ];
  }

  // Calculate pagination
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  // Build sort
  const sortOrder = order === 'asc' ? 1 : -1;
  const sortObj = { [sort]: sortOrder };

  // Execute queries
  const [total, employees] = await Promise.all([
    Employee.countDocuments(query),
    Employee.find(query)
      .populate('userId', 'email role isActive')
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .lean(),
  ]);

  paginated(res, employees, {
    total,
    page: pageNum,
    limit: limitNum,
  });
}));

// @route   GET /api/employees/:id
// @desc    Get employee by ID
// @access  Private
router.get('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const employee = await Employee.findById(req.params.id)
    .populate('userId', 'email role isActive')
    .lean();

  if (!employee) {
    throw new NotFoundError('Employee');
  }

  // Only allow access to own profile for regular employees
  if (req.user.role === 'employee' &&
        employee.userId._id.toString() !== req.user._id.toString()) {
    throw new ForbiddenError('You can only view your own profile');
  }

  success(res, employee);
}));

// @route   POST /api/employees
// @desc    Create new employee
// @access  Private (HR, Admin)
router.post('/', auth, authorize('hr', 'admin'), employeeCreateValidation, catchAsync(async (req, res) => {
  const { email, password, role, ...employeeData } = req.body;

  // Check if email exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    throw new ConflictError('Email already in use');
  }

  // Check if employeeId exists (if provided)
  if (employeeData.employeeId) {
    const existingEmployee = await Employee.findOne({ employeeId: employeeData.employeeId });
    if (existingEmployee) {
      throw new ConflictError('Employee ID already in use');
    }
  }

  // Create user account
  const user = new User({
    email: email.toLowerCase(),
    password: password || 'Password123!', // Default password with requirements
    role: role || 'employee',
  });
  await user.save();

  // Generate employee ID if not provided
  if (!employeeData.employeeId) {
    const count = await Employee.countDocuments();
    employeeData.employeeId = `EMP${String(count + 1).padStart(5, '0')}`;
  }

  // Create employee profile
  const employee = new Employee({
    userId: user._id,
    email: email.toLowerCase(),
    ...employeeData,
  });
  await employee.save();

  const populatedEmployee = await Employee.findById(employee._id)
    .populate('userId', 'email role isActive')
    .lean();

  created(res, populatedEmployee, 'Employee created successfully');
}));

// @route   PUT /api/employees/:id
// @desc    Update employee
// @access  Private (HR, Admin, or Self)
router.put('/:id', auth, idValidation, employeeUpdateValidation, catchAsync(async (req, res) => {
  const employee = await Employee.findById(req.params.id);

  if (!employee) {
    throw new NotFoundError('Employee');
  }

  // Check permissions
  const isOwnProfile = employee.userId.toString() === req.user._id.toString();
  const isHROrAdmin = ['hr', 'admin'].includes(req.user.role);

  if (!isOwnProfile && !isHROrAdmin) {
    throw new ForbiddenError('You can only update your own profile');
  }

  // Prepare update data
  const updateData = { ...req.body };

  // Restrict certain field updates for regular employees
  if (!isHROrAdmin) {
    const restrictedFields = ['salary', 'department', 'position', 'status', 'employeeId', 'hireDate'];
    restrictedFields.forEach(field => delete updateData[field]);
  }

  // Check for duplicate email if updating
  if (updateData.email && updateData.email !== employee.email) {
    const existingUser = await User.findOne({
      email: updateData.email.toLowerCase(),
      _id: { $ne: employee.userId },
    });
    if (existingUser) {
      throw new ConflictError('Email already in use');
    }
    updateData.email = updateData.email.toLowerCase();
  }

  const updatedEmployee = await Employee.findByIdAndUpdate(
    req.params.id,
    { $set: updateData },
    { new: true, runValidators: true },
  ).populate('userId', 'email role isActive').lean();

  success(res, updatedEmployee, 'Employee updated successfully');
}));

// @route   DELETE /api/employees/:id
// @desc    Delete (terminate) employee
// @access  Private (Admin only)
router.delete('/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const employee = await Employee.findById(req.params.id);

  if (!employee) {
    throw new NotFoundError('Employee');
  }

  // Soft delete - deactivate user and terminate employee
  await Promise.all([
    User.findByIdAndUpdate(employee.userId, { isActive: false }),
    Employee.findByIdAndUpdate(req.params.id, {
      status: 'terminated',
      terminationDate: new Date(),
    }),
  ]);

  success(res, null, 'Employee terminated successfully');
}));

// @route   GET /api/employees/departments/list
// @desc    Get list of departments
// @access  Private
router.get('/departments/list', auth, catchAsync(async (req, res) => {
  success(res, DEPARTMENTS);
}));

module.exports = router;
