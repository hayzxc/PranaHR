const express = require('express');
const prisma = require('../lib/prisma').default;
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
const bcrypt = require('bcryptjs');

const router = express.Router();

// @route   GET /api/employees/stats/summary
// @desc    Get employee statistics
// @access  Private (HR, Admin)
// NOTE: This route must be before /:id to avoid conflict
router.get('/stats/summary', auth, authorize('hr', 'admin'), catchAsync(async (req, res) => {
  const activeEmployees = await prisma.employee.findMany({
    where: { status: 'active' },
    select: { department: true, salary: true },
  });

  const departmentStats = activeEmployees.reduce((acc, emp) => {
    if (!acc[emp.department]) {
      acc[emp.department] = { count: 0, totalSalary: 0 };
    }
    acc[emp.department].count += 1;
    acc[emp.department].totalSalary += emp.salary;
    return acc;
  }, {});

  const stats = Object.entries(departmentStats).map(([dept, data]) => ({
    _id: dept,
    count: data.count,
    avgSalary: data.totalSalary / data.count,
  })).sort((a, b) => b.count - a.count);

  const departments = Object.keys(departmentStats);

  success(res, {
    totalEmployees: activeEmployees.length,
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
  const where = {};

  if (department && DEPARTMENTS.includes(department)) {
    where.department = department;
  }

  if (status) {
    where.status = status;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { employeeId: { contains: search, mode: 'insensitive' } },
      { position: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Calculate pagination
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  // Execute queries
  const [total, employees] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      include: {
        user: { select: { email: true, role: true, isActive: true } },
        manager: { select: { id: true, name: true } }
      },
      orderBy: { [sort]: order === 'asc' ? 'asc' : 'desc' },
      skip,
      take: limitNum,
    }),
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
  const employee = await prisma.employee.findUnique({
    where: { id: req.params.id },
    include: {
      user: { select: { id: true, email: true, role: true, isActive: true } },
      manager: { select: { id: true, name: true } }
    }
  });

  if (!employee) {
    throw new NotFoundError('Employee');
  }

  // Only allow access to own profile for regular employees
  if (req.user.role === 'employee' && employee.userId !== req.user.id) {
    throw new ForbiddenError('You can only view your own profile');
  }

  // Strip salary for non-HR/admin users (defense-in-depth)
  if (!['hr', 'admin'].includes(req.user.role)) {
    delete employee.salary;
  }

  success(res, employee);
}));

// @route   POST /api/employees
// @desc    Create new employee
// @access  Private (HR, Admin)
router.post('/', auth, authorize('hr', 'admin'), employeeCreateValidation, catchAsync(async (req, res) => {
  const { email, password, role, ...employeeData } = req.body;

  // Check if email exists
  const existingUser = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existingUser) {
    throw new ConflictError('Email already in use');
  }

  // Check if employeeId exists (if provided)
  if (employeeData.employeeId) {
    const existingEmployee = await prisma.employee.findUnique({ where: { employeeId: employeeData.employeeId } });
    if (existingEmployee) {
      throw new ConflictError('Employee ID already in use');
    }
  } else {
    // Generate employee ID if not provided
    const count = await prisma.employee.count();
    employeeData.employeeId = `EMP${String(count + 1).padStart(5, '0')}`;
  }

  // Create user account
  const isDefaultPassword = !password;
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password || 'Password123!', salt);
  
  if (isDefaultPassword) {
    console.warn(`⚠️  Employee created with default password for ${email}. Please force a password reset.`);
  }

  const user = await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      password: hashedPassword,
      role: role || 'employee',
      employee: {
        create: {
          email: email.toLowerCase(),
          ...employeeData,
          department: employeeData.department || 'Teknis dan IT',
          position: employeeData.position || 'Employee',
          salary: employeeData.salary || 0,
        }
      }
    },
    include: {
      employee: {
        include: {
          user: { select: { email: true, role: true, isActive: true } },
          manager: { select: { id: true, name: true } }
        }
      }
    }
  });

  created(res, user.employee, 'Employee created successfully');
}));

// @route   PUT /api/employees/:id
// @desc    Update employee
// @access  Private (HR, Admin, or Self)
router.put('/:id', auth, idValidation, employeeUpdateValidation, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });

  if (!employee) {
    throw new NotFoundError('Employee');
  }

  // Check permissions
  const isOwnProfile = employee.userId === req.user.id;
  const isHROrAdmin = ['hr', 'admin'].includes(req.user.role);

  if (!isOwnProfile && !isHROrAdmin) {
    throw new ForbiddenError('You can only update your own profile');
  }

  // Prepare update data
  const updateData = { ...req.body };

  // Restrict certain field updates for regular employees
  if (!isHROrAdmin) {
    const restrictedFields = ['salary', 'department', 'position', 'status', 'employeeId', 'hireDate', 'managerId'];
    restrictedFields.forEach(field => delete updateData[field]);
  }

  // Check for duplicate email if updating, and sync to User collection
  if (updateData.email && updateData.email !== employee.email) {
    const normalizedEmail = updateData.email.toLowerCase();
    const existingUser = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        id: { not: employee.userId },
      }
    });
    
    if (existingUser) {
      throw new ConflictError('Email already in use');
    }
    
    updateData.email = normalizedEmail;

    // CRITICAL FIX: Sync email change to User collection to prevent login de-sync
    await prisma.user.update({
      where: { id: employee.userId },
      data: { email: normalizedEmail }
    });
  }

  const updatedEmployee = await prisma.employee.update({
    where: { id: req.params.id },
    data: updateData,
    include: {
      user: { select: { email: true, role: true, isActive: true } },
      manager: { select: { id: true, name: true } }
    }
  });

  success(res, updatedEmployee, 'Employee updated successfully');
}));

// @route   DELETE /api/employees/:id
// @desc    Delete (terminate) employee
// @access  Private (Admin only)
router.delete('/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });

  if (!employee) {
    throw new NotFoundError('Employee');
  }

  // Soft delete - deactivate user and terminate employee
  await prisma.$transaction([
    prisma.user.update({
      where: { id: employee.userId },
      data: { isActive: false }
    }),
    prisma.employee.update({
      where: { id: req.params.id },
      data: { status: 'terminated' }
    })
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
