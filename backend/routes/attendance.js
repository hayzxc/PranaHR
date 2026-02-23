/**
 * Attendance Routes
 * Type-safe attendance tracking and reporting
 */

const express = require('express');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const { auth, authorize } = require('../middleware/auth');
const {
  idValidation,
  attendanceValidation,
  ATTENDANCE_STATUS,
} = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created, paginated } = require('../utils/response');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');

const router = express.Router();

/**
 * Get today's date at midnight (UTC)
 * @returns {Date} Today at 00:00:00
 */
const getTodayDate = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

/**
 * Calculate work hours between two dates
 * @param {Date} clockIn - Clock in time
 * @param {Date} clockOut - Clock out time
 * @returns {number} Hours worked (rounded to 2 decimal places)
 */
const calculateHours = (clockIn, clockOut) => {
  if (!clockIn || !clockOut) {return 0;}
  const diffMs = clockOut - clockIn;
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
};

// @route   GET /api/attendance/today
// @desc    Get today's attendance for current user
// @access  Private
router.get('/today', auth, catchAsync(async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user._id });

  if (!employee) {
    throw new NotFoundError('Employee profile');
  }

  const today = getTodayDate();
  const attendance = await Attendance.findOne({
    employeeId: employee._id,
    date: today,
  }).lean();

  success(res, {
    attendance,
    isClockedIn: attendance?.clockIn && !attendance?.clockOut,
    isClockedOut: attendance?.clockIn && attendance?.clockOut,
    employee: {
      id: employee._id,
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department,
    },
  });
}));

// @route   GET /api/attendance/summary
// @desc    Get attendance summary for date range
// @access  Private (HR, Admin)
router.get('/summary', auth, authorize('hr', 'admin'), catchAsync(async (req, res) => {
  const { startDate, endDate, department } = req.query;

  const start = startDate ? new Date(startDate) : new Date(new Date().setDate(1));
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);

  // Build match query
  const matchQuery = { date: { $gte: start, $lte: end } };

  // Filter by department if specified
  if (department) {
    const employeesInDept = await Employee.find({ department }).select('_id');
    matchQuery.employeeId = { $in: employeesInDept.map(e => e._id) };
  }

  const [byStatus, dailyCount, topAttendees] = await Promise.all([
    Attendance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgHours: { $avg: '$hoursWorked' },
        },
      },
      { $sort: { count: -1 } },
    ]),
    Attendance.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          count: { $sum: 1 },
          avgHours: { $avg: '$hoursWorked' },
          onTime: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ['$status', 'late'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Attendance.aggregate([
      { $match: { ...matchQuery, status: { $in: ['present', 'late'] } } },
      {
        $group: {
          _id: '$employeeId',
          totalDays: { $sum: 1 },
          totalHours: { $sum: '$hoursWorked' },
        },
      },
      { $sort: { totalDays: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'employees',
          localField: '_id',
          foreignField: '_id',
          as: 'employee',
        },
      },
      { $unwind: '$employee' },
      {
        $project: {
          _id: 1,
          totalDays: 1,
          totalHours: 1,
          name: '$employee.name',
          department: '$employee.department',
        },
      },
    ]),
  ]);

  success(res, {
    byStatus,
    dailyCount,
    topAttendees,
    period: { start, end },
  });
}));

// @route   GET /api/attendance/report/:id
// @desc    Get attendance report for specific employee
// @access  Private (HR, Admin, or Self)
router.get('/report/:id', auth, idValidation, catchAsync(async (req, res) => {
  const employee = await Employee.findById(req.params.id);

  if (!employee) {
    throw new NotFoundError('Employee');
  }

  // Check permissions
  const isOwner = employee.userId.toString() === req.user._id.toString();
  const isHROrAdmin = ['hr', 'admin'].includes(req.user.role);

  if (!isOwner && !isHROrAdmin) {
    throw new ForbiddenError('You can only view your own attendance report');
  }

  const { month, year } = req.query;
  const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
  const targetYear = year ? parseInt(year) : new Date().getFullYear();

  const startDate = new Date(targetYear, targetMonth, 1);
  const endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59);

  const records = await Attendance.find({
    employeeId: req.params.id,
    date: { $gte: startDate, $lte: endDate },
  }).sort({ date: 1 }).lean();

  // Calculate statistics
  const stats = {
    totalDays: records.length,
    present: records.filter(r => r.status === 'present').length,
    late: records.filter(r => r.status === 'late').length,
    absent: records.filter(r => r.status === 'absent').length,
    halfDay: records.filter(r => r.status === 'half_day').length,
    onLeave: records.filter(r => r.status === 'on_leave').length,
    totalHours: records.reduce((sum, r) => sum + (r.hoursWorked || 0), 0),
    avgHoursPerDay: records.length > 0
      ? Math.round((records.reduce((sum, r) => sum + (r.hoursWorked || 0), 0) / records.length) * 100) / 100
      : 0,
  };

  success(res, {
    employee: {
      id: employee._id,
      name: employee.name,
      employeeId: employee.employeeId,
      department: employee.department,
    },
    period: { month: targetMonth + 1, year: targetYear },
    records,
    stats,
  });
}));

// @route   GET /api/attendance
// @desc    Get attendance records
// @access  Private
router.get('/', auth, catchAsync(async (req, res) => {
  const { startDate, endDate, status, department, page = 1, limit = 10 } = req.query;

  const query = {};

  // Regular employees can only see their own attendance
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee) {
      throw new NotFoundError('Employee profile');
    }
    query.employeeId = employee._id;
  } else if (department) {
    // HR/Admin can filter by department
    const employeesInDept = await Employee.find({ department }).select('_id');
    query.employeeId = { $in: employeesInDept.map(e => e._id) };
  }

  // Date range filter
  if (startDate || endDate) {
    query.date = {};
    if (startDate) {query.date.$gte = new Date(startDate);}
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      query.date.$lte = end;
    }
  }

  // Status filter
  if (status && ATTENDANCE_STATUS.includes(status)) {
    query.status = status;
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, attendance] = await Promise.all([
    Attendance.countDocuments(query),
    Attendance.find(query)
      .populate('employeeId', 'name email employeeId department position')
      .sort({ date: -1, clockIn: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
  ]);

  paginated(res, attendance, { total, page: pageNum, limit: limitNum });
}));

// @route   POST /api/attendance/clock-in
// @desc    Clock in
// @access  Private
router.post('/clock-in', auth, attendanceValidation, catchAsync(async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user._id });

  if (!employee) {
    throw new NotFoundError('Employee profile');
  }

  if (employee.status !== 'active') {
    throw new BadRequestError('Only active employees can clock in');
  }

  const today = getTodayDate();

  // Check if already clocked in today
  let attendance = await Attendance.findOne({
    employeeId: employee._id,
    date: today,
  });

  if (attendance && attendance.clockIn) {
    throw new BadRequestError('Already clocked in today');
  }

  const clockInTime = new Date();

  if (!attendance) {
    attendance = new Attendance({
      employeeId: employee._id,
      date: today,
    });
  }

  attendance.clockIn = clockInTime;
  attendance.ipAddress = req.ip || req.connection.remoteAddress;

  // Optional location
  if (req.body.latitude && req.body.longitude) {
    attendance.location = {
      type: 'Point',
      coordinates: [parseFloat(req.body.longitude), parseFloat(req.body.latitude)],
    };
  }

  // Determine if late (after 9 AM)
  const lateThreshold = new Date(today);
  lateThreshold.setHours(9, 15, 0, 0); // 9:15 AM grace period

  if (clockInTime > lateThreshold) {
    attendance.status = 'late';
  } else {
    attendance.status = 'present';
  }

  await attendance.save();

  const populatedAttendance = await Attendance.findById(attendance._id)
    .populate('employeeId', 'name email employeeId department')
    .lean();

  created(res, {
    attendance: populatedAttendance,
    clockInTime: clockInTime.toISOString(),
  }, 'Clock in successful');
}));

// @route   POST /api/attendance/clock-out
// @desc    Clock out
// @access  Private
router.post('/clock-out', auth, catchAsync(async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user._id });

  if (!employee) {
    throw new NotFoundError('Employee profile');
  }

  const today = getTodayDate();

  const attendance = await Attendance.findOne({
    employeeId: employee._id,
    date: today,
  });

  if (!attendance || !attendance.clockIn) {
    throw new BadRequestError('Not clocked in today');
  }

  if (attendance.clockOut) {
    throw new BadRequestError('Already clocked out today');
  }

  const clockOutTime = new Date();
  attendance.clockOut = clockOutTime;
  attendance.hoursWorked = calculateHours(attendance.clockIn, clockOutTime);
  attendance.notes = req.body.notes || '';

  // Check if half day (less than 4 hours)
  if (attendance.hoursWorked < 4 && attendance.status !== 'late') {
    attendance.status = 'half_day';
  }

  await attendance.save();

  const populatedAttendance = await Attendance.findById(attendance._id)
    .populate('employeeId', 'name email employeeId department')
    .lean();

  success(res, {
    attendance: populatedAttendance,
    clockOutTime: clockOutTime.toISOString(),
    hoursWorked: attendance.hoursWorked,
  }, 'Clock out successful');
}));

// @route   PUT /api/attendance/:id
// @desc    Update attendance record (HR/Admin only)
// @access  Private (HR, Admin)
router.put('/:id', auth, authorize('hr', 'admin'), idValidation, catchAsync(async (req, res) => {
  const attendance = await Attendance.findById(req.params.id);

  if (!attendance) {
    throw new NotFoundError('Attendance record');
  }

  const allowedUpdates = ['status', 'clockIn', 'clockOut', 'notes'];
  const updates = {};

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  });

  // Recalculate hours if clock times are updated
  if (updates.clockIn || updates.clockOut) {
    const clockIn = updates.clockIn ? new Date(updates.clockIn) : attendance.clockIn;
    const clockOut = updates.clockOut ? new Date(updates.clockOut) : attendance.clockOut;
    if (clockIn && clockOut) {
      updates.hoursWorked = calculateHours(clockIn, clockOut);
    }
  }

  const updatedAttendance = await Attendance.findByIdAndUpdate(
    req.params.id,
    { $set: updates },
    { new: true, runValidators: true },
  ).populate('employeeId', 'name email employeeId department').lean();

  success(res, updatedAttendance, 'Attendance record updated');
}));

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record (Admin only)
// @access  Private (Admin)
router.delete('/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const attendance = await Attendance.findById(req.params.id);

  if (!attendance) {
    throw new NotFoundError('Attendance record');
  }

  await Attendance.findByIdAndDelete(req.params.id);

  success(res, null, 'Attendance record deleted');
}));

// @route   GET /api/attendance/statuses/list
// @desc    Get list of attendance statuses
// @access  Private
router.get('/statuses/list', auth, catchAsync(async (req, res) => {
  success(res, ATTENDANCE_STATUS);
}));

module.exports = router;
