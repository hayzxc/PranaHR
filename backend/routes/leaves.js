/**
 * Leave Routes
 * Type-safe leave request management
 */

const express = require('express');
const Leave = require('../models/Leave');
const Employee = require('../models/Employee');
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

// @route   GET /api/leaves/stats
// @desc    Get leave statistics
// @access  Private (HR, Admin)
// NOTE: Must be before /:id route
router.get('/stats', auth, authorize('hr', 'admin'), catchAsync(async (req, res) => {
  const [byStatus, byType, monthlyStats] = await Promise.all([
    Leave.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 }, totalDays: { $sum: '$totalDays' } } },
      { $sort: { count: -1 } },
    ]),
    Leave.aggregate([
      { $group: { _id: '$type', count: { $sum: 1 }, totalDays: { $sum: '$totalDays' } } },
      { $sort: { count: -1 } },
    ]),
    Leave.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(new Date().getFullYear(), 0, 1) },
        },
      },
      {
        $group: {
          _id: { $month: '$startDate' },
          count: { $sum: 1 },
          totalDays: { $sum: '$totalDays' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  success(res, { byStatus, byType, monthlyStats });
}));

// @route   GET /api/leaves/pending
// @desc    Get pending leave requests (HR/Admin)
// @access  Private (HR, Admin)
router.get('/pending', auth, authorize('hr', 'admin'), catchAsync(async (req, res) => {
  const leaves = await Leave.find({ status: 'pending' })
    .populate('employeeId', 'name email employeeId department position')
    .sort({ createdAt: -1 })
    .lean();

  success(res, leaves);
}));

// @route   GET /api/leaves/my
// @desc    Get current user's leaves
// @access  Private
router.get('/my', auth, catchAsync(async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user._id });

  if (!employee) {
    throw new NotFoundError('Employee profile');
  }

  const { status, type, year } = req.query;
  const query = { employeeId: employee._id };

  if (status && LEAVE_STATUS.includes(status)) { query.status = status; }
  if (type && LEAVE_TYPES.includes(type)) { query.type = type; }
  if (year) {
    const yearNum = parseInt(year);
    query.startDate = {
      $gte: new Date(yearNum, 0, 1),
      $lte: new Date(yearNum, 11, 31),
    };
  }

  const leaves = await Leave.find(query)
    .sort({ createdAt: -1 })
    .lean();

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

  const query = {};

  // Regular employees can only see their own leaves
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee) {
      throw new NotFoundError('Employee profile');
    }
    query.employeeId = employee._id;
  }

  if (status && LEAVE_STATUS.includes(status)) { query.status = status; }
  if (type && LEAVE_TYPES.includes(type)) { query.type = type; }

  // Filter by department (HR/Admin only)
  if (department && req.user.role !== 'employee') {
    const employeesInDept = await Employee.find({ department }).select('_id');
    query.employeeId = { $in: employeesInDept.map(e => e._id) };
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, leaves] = await Promise.all([
    Leave.countDocuments(query),
    Leave.find(query)
      .populate('employeeId', 'name email employeeId department position')
      .populate('approvedBy', 'email')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
  ]);

  paginated(res, leaves, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/leaves/:id
// @desc    Get leave by ID
// @access  Private
router.get('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const leave = await Leave.findById(req.params.id)
    .populate('employeeId', 'name email employeeId department position userId')
    .populate('approvedBy', 'email')
    .lean();

  if (!leave) {
    throw new NotFoundError('Leave request');
  }

  // Check access - employee can only see their own
  if (req.user.role === 'employee' &&
    leave.employeeId.userId.toString() !== req.user._id.toString()) {
    throw new ForbiddenError('You can only view your own leave requests');
  }

  success(res, leave);
}));

// @route   POST /api/leaves
// @desc    Apply for leave
// @access  Private
router.post('/', auth, leaveCreateValidation, catchAsync(async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user._id });

  if (!employee) {
    throw new NotFoundError('Employee profile');
  }

  const { startDate, endDate, type, reason } = req.body;

  // Validate dates
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (end < start) {
    throw new BadRequestError('End date cannot be before start date');
  }

  // Calculate total days
  const diffTime = Math.abs(end - start);
  const totalDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // Check for overlapping leaves
  const overlapping = await Leave.findOne({
    employeeId: employee._id,
    status: { $in: ['pending', 'approved'] },
    $or: [
      { startDate: { $lte: end }, endDate: { $gte: start } },
    ],
  });

  if (overlapping) {
    throw new BadRequestError('You already have a leave request for these dates');
  }

  const leave = new Leave({
    employeeId: employee._id,
    type,
    startDate: start,
    endDate: end,
    totalDays,
    reason,
  });

  await leave.save();

  const populatedLeave = await Leave.findById(leave._id)
    .populate('employeeId', 'name email employeeId department')
    .lean();

  created(res, populatedLeave, 'Leave request submitted successfully');
}));

// @route   PUT /api/leaves/:id/approve
// @desc    Approve leave request
// @access  Private (HR, Admin)
router.put('/:id/approve', auth, authorize('hr', 'admin'), idValidation, catchAsync(async (req, res) => {
  const leave = await Leave.findById(req.params.id);

  if (!leave) {
    throw new NotFoundError('Leave request');
  }

  if (leave.status !== 'pending') {
    throw new BadRequestError(`Leave request already ${leave.status}`);
  }

  leave.status = 'approved';
  leave.approvedBy = req.user._id;
  leave.approvedAt = new Date();
  leave.reviewNotes = req.body.notes || null;
  await leave.save();

  const populatedLeave = await Leave.findById(leave._id)
    .populate('employeeId', 'name email employeeId department')
    .populate('approvedBy', 'email')
    .lean();

  // Notify the employee their leave was approved
  if (populatedLeave.employeeId) {
    const emp = await Employee.findById(leave.employeeId);
    if (emp?.userId) {
      createNotification({
        recipient: emp.userId,
        type: 'leave_approved',
        title: 'Leave Approved ✅',
        message: `Your ${leave.type} leave request (${leave.totalDays} day${leave.totalDays > 1 ? 's' : ''}) has been approved.`,
        link: '/leaves',
        relatedId: leave._id,
      });
    }
  }

  success(res, populatedLeave, 'Leave request approved');
}));

// @route   PUT /api/leaves/:id/reject
// @desc    Reject leave request
// @access  Private (HR, Admin)
router.put('/:id/reject', auth, authorize('hr', 'admin'), idValidation, catchAsync(async (req, res) => {
  const leave = await Leave.findById(req.params.id);

  if (!leave) {
    throw new NotFoundError('Leave request');
  }

  if (leave.status !== 'pending') {
    throw new BadRequestError(`Leave request already ${leave.status}`);
  }

  leave.status = 'rejected';
  leave.approvedBy = req.user._id;
  leave.approvedAt = new Date();
  leave.rejectionReason = req.body.reason || 'No reason provided';
  leave.reviewNotes = req.body.notes || null;
  await leave.save();

  const populatedLeave = await Leave.findById(leave._id)
    .populate('employeeId', 'name email employeeId department')
    .populate('approvedBy', 'email')
    .lean();

  // Notify the employee their leave was rejected
  if (populatedLeave.employeeId) {
    const emp = await Employee.findById(leave.employeeId);
    if (emp?.userId) {
      createNotification({
        recipient: emp.userId,
        type: 'leave_rejected',
        title: 'Leave Rejected ❌',
        message: `Your ${leave.type} leave request was rejected. Reason: ${leave.rejectionReason}`,
        link: '/leaves',
        relatedId: leave._id,
      });
    }
  }

  success(res, populatedLeave, 'Leave request rejected');
}));

// @route   PUT /api/leaves/:id/cancel
// @desc    Cancel leave request
// @access  Private
router.put('/:id/cancel', auth, idValidation, catchAsync(async (req, res) => {
  const leave = await Leave.findById(req.params.id).populate('employeeId');

  if (!leave) {
    throw new NotFoundError('Leave request');
  }

  // Only allow cancellation by the employee who submitted or HR/Admin
  const isOwner = leave.employeeId.userId.toString() === req.user._id.toString();
  const isHROrAdmin = ['hr', 'admin'].includes(req.user.role);

  if (!isOwner && !isHROrAdmin) {
    throw new ForbiddenError('You can only cancel your own leave requests');
  }

  if (leave.status !== 'pending') {
    throw new BadRequestError('Can only cancel pending leave requests');
  }

  leave.status = 'cancelled';
  leave.cancelledAt = new Date();
  await leave.save();

  success(res, leave, 'Leave request cancelled');
}));

// @route   DELETE /api/leaves/:id
// @desc    Delete leave request (Admin only)
// @access  Private (Admin)
router.delete('/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const leave = await Leave.findById(req.params.id);

  if (!leave) {
    throw new NotFoundError('Leave request');
  }

  await Leave.findByIdAndDelete(req.params.id);

  success(res, null, 'Leave request deleted');
}));

// @route   GET /api/leaves/types/list
// @desc    Get list of leave types
// @access  Private
router.get('/types/list', auth, catchAsync(async (req, res) => {
  success(res, LEAVE_TYPES);
}));

module.exports = router;
