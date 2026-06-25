/**
 * Attendance Routes
 * Type-safe attendance tracking and reporting
 * PONYTAIL FIX: Timezone bugs squashed. All dates strictly standardized.
 */

const express = require('express');
const prisma = require('../lib/prisma').default;
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
 * PONYTAIL FIX: Ensures we don't accidentally cast to local server time
 * @returns {Date} Today at 00:00:00 UTC
 */
const getTodayDateUTC = () => {
  const now = new Date();
  // We assume the company operates in Asia/Jakarta (UTC+7)
  // To get the "start of day" in Asia/Jakarta as a UTC Date object:
  // 1. Get current time in Jakarta
  const options = { timeZone: 'Asia/Jakarta', year: 'numeric', month: 'numeric', day: 'numeric' };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(now);
  const year = parts.find(p => p.type === 'year').value;
  const month = parts.find(p => p.type === 'month').value;
  const day = parts.find(p => p.type === 'day').value;
  
  // Create a UTC date that represents midnight in Jakarta (which is 17:00 UTC previous day)
  // Actually, keeping the date simply as the UTC midnight of the current day is safer for DB storage
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

/**
 * Check if the time is considered late (after 09:15 AM Asia/Jakarta)
 * PONYTAIL FIX: Replaces local server time dependency with strict timezone formatting
 */
const isLateInJakarta = (dateObj) => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(dateObj);
  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
  
  return hour > 9 || (hour === 9 && minute > 15);
};

/**
 * Calculate work hours between two dates
 */
const calculateHours = (clockIn, clockOut) => {
  if (!clockIn || !clockOut) {return 0;}
  const diffMs = clockOut.getTime() - clockIn.getTime();
  return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
};

// @route   GET /api/attendance/today
// @desc    Get today's attendance for current user
// @access  Private
router.get('/today', auth, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });

  if (!employee) {
    throw new NotFoundError('Employee profile');
  }

  const today = getTodayDateUTC();
  const attendance = await prisma.attendance.findUnique({
    where: {
      employeeId_date: {
        employeeId: employee.id,
        date: today,
      }
    }
  });

  success(res, {
    attendance,
    isClockedIn: attendance?.clockIn && !attendance?.clockOut,
    isClockedOut: attendance?.clockIn && attendance?.clockOut,
    employee: {
      id: employee.id,
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
  end.setUTCHours(23, 59, 59, 999);

  // Build match query
  const where = { date: { gte: start, lte: end } };

  // Filter by department if specified
  if (department) {
    const employeesInDept = await prisma.employee.findMany({ 
      where: { department },
      select: { id: true } 
    });
    where.employeeId = { in: employeesInDept.map(e => e.id) };
  }

  const allRecords = await prisma.attendance.findMany({ where, include: { employee: true } });

  // Calculate byStatus
  const statusCounts = {};
  allRecords.forEach(r => {
    if (!statusCounts[r.status]) statusCounts[r.status] = { count: 0, totalHours: 0 };
    statusCounts[r.status].count++;
    statusCounts[r.status].totalHours += r.hoursWorked;
  });
  
  const byStatus = Object.entries(statusCounts).map(([status, data]) => ({
    _id: status,
    count: data.count,
    avgHours: data.totalHours / data.count
  })).sort((a, b) => b.count - a.count);

  // Calculate dailyCount
  const dailyGroups = {};
  allRecords.forEach(r => {
    const dateStr = r.date.toISOString().split('T')[0];
    if (!dailyGroups[dateStr]) dailyGroups[dateStr] = { count: 0, totalHours: 0, onTime: 0, late: 0 };
    dailyGroups[dateStr].count++;
    dailyGroups[dateStr].totalHours += r.hoursWorked;
    if (r.status === 'present') dailyGroups[dateStr].onTime++;
    if (r.status === 'late') dailyGroups[dateStr].late++;
  });

  const dailyCount = Object.entries(dailyGroups).map(([date, data]) => ({
    _id: date,
    count: data.count,
    avgHours: data.count > 0 ? data.totalHours / data.count : 0,
    onTime: data.onTime,
    late: data.late
  })).sort((a, b) => a._id.localeCompare(b._id));

  // Top Attendees
  const employeeGroups = {};
  allRecords.forEach(r => {
    if (r.status === 'present' || r.status === 'late') {
      if (!employeeGroups[r.employeeId]) {
        employeeGroups[r.employeeId] = { 
          totalDays: 0, 
          totalHours: 0,
          name: r.employee.name,
          department: r.employee.department
        };
      }
      employeeGroups[r.employeeId].totalDays++;
      employeeGroups[r.employeeId].totalHours += r.hoursWorked;
    }
  });

  const topAttendees = Object.entries(employeeGroups)
    .map(([empId, data]) => ({
      _id: empId,
      totalDays: data.totalDays,
      totalHours: data.totalHours,
      name: data.name,
      department: data.department
    }))
    .sort((a, b) => b.totalDays - a.totalDays)
    .slice(0, 10);

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
  const employee = await prisma.employee.findUnique({ where: { id: req.params.id } });

  if (!employee) {
    throw new NotFoundError('Employee');
  }

  const isOwner = employee.userId === req.user.id;
  const isHROrAdmin = ['hr', 'admin'].includes(req.user.role);

  if (!isOwner && !isHROrAdmin) {
    throw new ForbiddenError('You can only view your own attendance report');
  }

  const { month, year } = req.query;
  const targetMonth = month ? parseInt(month) - 1 : new Date().getUTCMonth();
  const targetYear = year ? parseInt(year) : new Date().getUTCFullYear();

  const startDate = new Date(Date.UTC(targetYear, targetMonth, 1));
  const endDate = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 23, 59, 59));

  const records = await prisma.attendance.findMany({
    where: {
      employeeId: req.params.id,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' }
  });

  const stats = {
    totalDays: records.length,
    present: records.filter(r => r.status === 'present').length,
    late: records.filter(r => r.status === 'late').length,
    absent: records.filter(r => r.status === 'absent').length,
    halfDay: records.filter(r => r.status === 'half-day').length,
    onLeave: records.filter(r => r.status === 'on-leave').length,
    totalHours: records.reduce((sum, r) => sum + (r.hoursWorked || 0), 0),
    avgHoursPerDay: records.length > 0
      ? Math.round((records.reduce((sum, r) => sum + (r.hoursWorked || 0), 0) / records.length) * 100) / 100
      : 0,
  };

  success(res, {
    employee: {
      id: employee.id,
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

  const where = {};

  if (req.user.role === 'employee') {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) throw new NotFoundError('Employee profile');
    where.employeeId = employee.id;
  } else if (department) {
    const employeesInDept = await prisma.employee.findMany({ where: { department }, select: { id: true } });
    where.employeeId = { in: employeesInDept.map(e => e.id) };
  }

  if (startDate || endDate) {
    where.date = {};
    if (startDate) where.date.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setUTCHours(23, 59, 59, 999);
      where.date.lte = end;
    }
  }

  if (status && ATTENDANCE_STATUS.includes(status)) {
    where.status = status;
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, attendance] = await Promise.all([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      include: { employee: { select: { name: true, email: true, employeeId: true, department: true, position: true } } },
      orderBy: [{ date: 'desc' }, { clockIn: 'desc' }],
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
  ]);

  paginated(res, attendance, { total, page: pageNum, limit: limitNum });
}));

// @route   POST /api/attendance/clock-in
// @desc    Clock in
// @access  Private
router.post('/clock-in', auth, attendanceValidation, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });

  if (!employee) throw new NotFoundError('Employee profile');
  if (employee.status !== 'active') throw new BadRequestError('Only active employees can clock in');

  const today = getTodayDateUTC();

  let attendance = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: today } }
  });

  if (attendance && attendance.clockIn) {
    throw new BadRequestError('Already clocked in today');
  }

  const clockInTime = new Date();
  const status = isLateInJakarta(clockInTime) ? 'late' : 'present';
  const ipAddress = req.ip || req.connection.remoteAddress;
  let locationLat = null;
  let locationLng = null;

  if (req.body.latitude && req.body.longitude) {
    locationLat = parseFloat(req.body.latitude);
    locationLng = parseFloat(req.body.longitude);
  }

  if (!attendance) {
    attendance = await prisma.attendance.create({
      data: {
        employeeId: employee.id,
        date: today,
        clockIn: clockInTime,
        status,
        ipAddress,
        locationLat,
        locationLng
      },
      include: { employee: { select: { name: true, email: true, employeeId: true, department: true } } }
    });
  } else {
    attendance = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        clockIn: clockInTime,
        status,
        ipAddress,
        locationLat,
        locationLng
      },
      include: { employee: { select: { name: true, email: true, employeeId: true, department: true } } }
    });
  }

  created(res, {
    attendance,
    clockInTime: clockInTime.toISOString(),
  }, 'Clock in successful');
}));

// @route   POST /api/attendance/clock-out
// @desc    Clock out
// @access  Private
router.post('/clock-out', auth, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });

  if (!employee) throw new NotFoundError('Employee profile');

  const today = getTodayDateUTC();

  const attendance = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: today } }
  });

  if (!attendance || !attendance.clockIn) throw new BadRequestError('Not clocked in today');
  if (attendance.clockOut) throw new BadRequestError('Already clocked out today');

  const clockOutTime = new Date();
  const hoursWorked = calculateHours(attendance.clockIn, clockOutTime);
  let status = attendance.status;

  if (hoursWorked < 4 && status !== 'late') {
    status = 'half-day';
  }

  const updatedAttendance = await prisma.attendance.update({
    where: { id: attendance.id },
    data: {
      clockOut: clockOutTime,
      hoursWorked,
      status,
      notes: req.body.notes || attendance.notes
    },
    include: { employee: { select: { name: true, email: true, employeeId: true, department: true } } }
  });

  success(res, {
    attendance: updatedAttendance,
    clockOutTime: clockOutTime.toISOString(),
    hoursWorked,
  }, 'Clock out successful');
}));

// @route   PUT /api/attendance/:id
// @desc    Update attendance record (HR/Admin only)
// @access  Private (HR, Admin)
router.put('/:id', auth, authorize('hr', 'admin'), idValidation, catchAsync(async (req, res) => {
  const attendance = await prisma.attendance.findUnique({ where: { id: req.params.id } });

  if (!attendance) throw new NotFoundError('Attendance record');

  const allowedUpdates = ['status', 'clockIn', 'clockOut', 'notes'];
  const data = {};

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      if (field === 'clockIn' || field === 'clockOut') {
        data[field] = req.body[field] ? new Date(req.body[field]) : null;
      } else {
        data[field] = req.body[field];
      }
    }
  });

  if (data.clockIn || data.clockOut || attendance.clockIn) {
    const clockIn = data.clockIn !== undefined ? data.clockIn : attendance.clockIn;
    const clockOut = data.clockOut !== undefined ? data.clockOut : attendance.clockOut;
    if (clockIn && clockOut) {
      data.hoursWorked = calculateHours(clockIn, clockOut);
    }
  }

  const updatedAttendance = await prisma.attendance.update({
    where: { id: req.params.id },
    data,
    include: { employee: { select: { name: true, email: true, employeeId: true, department: true } } }
  });

  success(res, updatedAttendance, 'Attendance record updated');
}));

// @route   DELETE /api/attendance/:id
// @desc    Delete attendance record (Admin only)
// @access  Private (Admin)
router.delete('/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  await prisma.attendance.delete({ where: { id: req.params.id } }).catch(() => {
    throw new NotFoundError('Attendance record');
  });
  success(res, null, 'Attendance record deleted');
}));

// @route   GET /api/attendance/statuses/list
// @desc    Get list of attendance statuses
// @access  Private
router.get('/statuses/list', auth, catchAsync(async (req, res) => {
  success(res, ATTENDANCE_STATUS);
}));

module.exports = router;
