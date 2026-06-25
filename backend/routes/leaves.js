/**
 * Leave Routes
 * Type-safe leave request management
 * PONYTAIL FIX: Prisma ORM Integration & Business Days calculation
 */

const express = require('express');
const prisma = require('../lib/prisma').default;
const { auth, authorize } = require('../middleware/auth');
const {
  leaveCreateValidation,
  leaveUpdateValidation,
  idValidation,
  searchValidation,
  LEAVE_TYPES,
  LEAVE_STATUS,
} = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created, paginated } = require('../utils/response');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');
const { createNotification } = require('../utils/notifications');

const router = express.Router();

/**
 * PONYTAIL FIX: Safely calculate business days (excluding weekends)
 * In a real HRIS, this should also check a Holidays collection
 */
const calculateBusinessDays = (startDate, endDate) => {
  let count = 0;
  const curDate = new Date(startDate.getTime());
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getUTCDay();
    // 0 is Sunday, 6 is Saturday
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      count++;
    }
    curDate.setUTCDate(curDate.getUTCDate() + 1);
  }
  return count;
};

// @route   GET /api/leaves/stats
// @desc    Get leave statistics
// @access  Private (HR, Admin)
// NOTE: Must be before /:id route
router.get('/stats', auth, authorize('hr', 'admin'), catchAsync(async (req, res) => {
  const currentYearStart = new Date(new Date().getFullYear(), 0, 1);

  const leaves = await prisma.leave.findMany({
    where: { createdAt: { gte: currentYearStart } }
  });

  const statusCount = {};
  const typeCount = {};
  const monthlyCount = {};

  leaves.forEach(l => {
    // By Status
    if (!statusCount[l.status]) statusCount[l.status] = { count: 0, totalDays: 0 };
    statusCount[l.status].count++;
    statusCount[l.status].totalDays += l.totalDays;

    // By Type
    if (!typeCount[l.type]) typeCount[l.type] = { count: 0, totalDays: 0 };
    typeCount[l.type].count++;
    typeCount[l.type].totalDays += l.totalDays;

    // By Month
    const month = l.startDate.getUTCMonth() + 1;
    if (!monthlyCount[month]) monthlyCount[month] = { count: 0, totalDays: 0 };
    monthlyCount[month].count++;
    monthlyCount[month].totalDays += l.totalDays;
  });

  const byStatus = Object.entries(statusCount).map(([id, data]) => ({ _id: id, ...data })).sort((a, b) => b.count - a.count);
  const byType = Object.entries(typeCount).map(([id, data]) => ({ _id: id, ...data })).sort((a, b) => b.count - a.count);
  const monthlyStats = Object.entries(monthlyCount).map(([id, data]) => ({ _id: parseInt(id), ...data })).sort((a, b) => a._id - b._id);

  success(res, { byStatus, byType, monthlyStats });
}));

// @route   GET /api/leaves/pending
// @desc    Get pending leave requests (HR/Admin)
// @access  Private (HR, Admin)
router.get('/pending', auth, authorize('hr', 'admin'), catchAsync(async (req, res) => {
  const leaves = await prisma.leave.findMany({
    where: { status: 'pending' },
    include: {
      employee: { select: { name: true, email: true, employeeId: true, department: true, position: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  success(res, leaves);
}));

// @route   GET /api/leaves/my
// @desc    Get current user's leaves
// @access  Private
router.get('/my', auth, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });

  if (!employee) {
    throw new NotFoundError('Employee profile');
  }

  const { status, type, year } = req.query;
  const where = { employeeId: employee.id };

  if (status && LEAVE_STATUS.includes(status)) { where.status = status; }
  if (type && LEAVE_TYPES.includes(type)) { where.type = type; }
  if (year) {
    const yearNum = parseInt(year);
    where.startDate = {
      gte: new Date(Date.UTC(yearNum, 0, 1)),
      lte: new Date(Date.UTC(yearNum, 11, 31, 23, 59, 59)),
    };
  }

  const leaves = await prisma.leave.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  // Calculate summary
  const summary = {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'pending').length,
    approved: leaves.filter(l => l.status === 'approved').length,
    rejected: leaves.filter(l => l.status === 'rejected').length,
    totalDaysUsed: leaves
      .filter(l => l.status === 'approved')
      .reduce((sum, l) => sum + (l.totalDays || 0), 0),
  };

  success(res, { leaves, summary });
}));

// @route   GET /api/leaves
// @desc    Get all leaves (HR/Admin) or own leaves (Employee)
// @access  Private
router.get('/', auth, searchValidation, catchAsync(async (req, res) => {
  const { status, type, department, page = 1, limit = 10 } = req.query;

  const where = {};

  // Regular employees can only see their own leaves
  if (req.user.role === 'employee') {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) throw new NotFoundError('Employee profile');
    where.employeeId = employee.id;
  } else if (department) {
    const employeesInDept = await prisma.employee.findMany({ where: { department }, select: { id: true } });
    where.employeeId = { in: employeesInDept.map(e => e.id) };
  }

  if (status && LEAVE_STATUS.includes(status)) { where.status = status; }
  if (type && LEAVE_TYPES.includes(type)) { where.type = type; }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, leaves] = await Promise.all([
    prisma.leave.count({ where }),
    prisma.leave.findMany({
      where,
      include: {
        employee: { select: { name: true, email: true, employeeId: true, department: true, position: true } },
        approvedBy: { select: { email: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
  ]);

  paginated(res, leaves, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/leaves/:id
// @desc    Get leave by ID
// @access  Private
router.get('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const leave = await prisma.leave.findUnique({
    where: { id: req.params.id },
    include: {
      employee: { select: { userId: true, name: true, email: true, employeeId: true, department: true, position: true } },
      approvedBy: { select: { email: true } }
    }
  });

  if (!leave) {
    throw new NotFoundError('Leave request');
  }

  // Check access - employee can only see their own
  if (req.user.role === 'employee' && leave.employee.userId !== req.user.id) {
    throw new ForbiddenError('You can only view your own leave requests');
  }

  success(res, leave);
}));

// @route   POST /api/leaves
// @desc    Apply for leave
// @access  Private
router.post('/', auth, leaveCreateValidation, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });

  if (!employee) throw new NotFoundError('Employee profile');

  const { startDate, endDate, type, reason } = req.body;

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    throw new BadRequestError('End date cannot be before start date');
  }

  // PONYTAIL FIX: Calculate proper business days
  const totalDays = calculateBusinessDays(start, end);

  if (totalDays <= 0) {
    throw new BadRequestError('Leave request must include at least one business day');
  }

  // Check for overlapping leaves
  const overlapping = await prisma.leave.findFirst({
    where: {
      employeeId: employee.id,
      status: { in: ['pending', 'approved'] },
      OR: [
        { startDate: { lte: end }, endDate: { gte: start } },
      ],
    }
  });

  if (overlapping) {
    throw new BadRequestError('You already have a leave request for these dates');
  }

  const leave = await prisma.leave.create({
    data: {
      employeeId: employee.id,
      type,
      startDate: start,
      endDate: end,
      totalDays,
      reason,
      attachments: req.body.attachments || [],
    },
    include: {
      employee: { select: { name: true, email: true, employeeId: true, department: true } }
    }
  });

  created(res, leave, 'Leave request submitted successfully');
}));

// @route   PUT /api/leaves/:id/approve
// @desc    Approve leave request
// @access  Private (HR, Admin)
router.put('/:id/approve', auth, authorize('hr', 'admin'), idValidation, catchAsync(async (req, res) => {
  let leave = await prisma.leave.findUnique({ where: { id: req.params.id } });

  if (!leave) throw new NotFoundError('Leave request');

  if (leave.status !== 'pending') {
    throw new BadRequestError(`Leave request already ${leave.status}`);
  }

  leave = await prisma.leave.update({
    where: { id: req.params.id },
    data: {
      status: 'approved',
      approvedById: req.user.id,
      approvedAt: new Date()
    },
    include: {
      employee: { select: { userId: true, name: true, email: true, employeeId: true, department: true } },
      approvedBy: { select: { email: true } }
    }
  });

  // Notify the employee their leave was approved (stub for notification logic)
  if (leave.employee && leave.employee.userId) {
    // createNotification stub...
  }

  success(res, leave, 'Leave request approved');
}));

// @route   PUT /api/leaves/:id/reject
// @desc    Reject leave request
// @access  Private (HR, Admin)
router.put('/:id/reject', auth, authorize('hr', 'admin'), idValidation, catchAsync(async (req, res) => {
  let leave = await prisma.leave.findUnique({ where: { id: req.params.id } });

  if (!leave) throw new NotFoundError('Leave request');

  if (leave.status !== 'pending') {
    throw new BadRequestError(`Leave request already ${leave.status}`);
  }

  leave = await prisma.leave.update({
    where: { id: req.params.id },
    data: {
      status: 'rejected',
      approvedById: req.user.id,
      approvedAt: new Date(),
      rejectionReason: req.body.reason || 'No reason provided'
    },
    include: {
      employee: { select: { userId: true, name: true, email: true, employeeId: true, department: true } },
      approvedBy: { select: { email: true } }
    }
  });

  success(res, leave, 'Leave request rejected');
}));

// @route   PUT /api/leaves/:id/cancel
// @desc    Cancel leave request
// @access  Private
router.put('/:id/cancel', auth, idValidation, catchAsync(async (req, res) => {
  let leave = await prisma.leave.findUnique({ 
    where: { id: req.params.id },
    include: { employee: true }
  });

  if (!leave) throw new NotFoundError('Leave request');

  const isOwner = leave.employee.userId === req.user.id;
  const isHROrAdmin = ['hr', 'admin'].includes(req.user.role);

  if (!isOwner && !isHROrAdmin) {
    throw new ForbiddenError('You can only cancel your own leave requests');
  }

  if (leave.status !== 'pending') {
    throw new BadRequestError('Can only cancel pending leave requests');
  }

  leave = await prisma.leave.update({
    where: { id: req.params.id },
    data: {
      status: 'cancelled',
      // We don't have cancelledAt in the prisma schema currently, we rely on updatedAt
    }
  });

  success(res, leave, 'Leave request cancelled');
}));

// @route   DELETE /api/leaves/:id
// @desc    Delete leave request (Admin only)
// @access  Private (Admin)
router.delete('/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  await prisma.leave.delete({ where: { id: req.params.id } }).catch(() => {
    throw new NotFoundError('Leave request');
  });

  success(res, null, 'Leave request deleted');
}));

// @route   GET /api/leaves/types/list
// @desc    Get list of leave types
// @access  Private
router.get('/types/list', auth, catchAsync(async (req, res) => {
  success(res, LEAVE_TYPES);
}));

module.exports = router;
