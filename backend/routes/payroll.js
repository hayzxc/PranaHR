/**
 * Payroll Routes
 * Type-safe payroll management and processing
 */

const express = require('express');
const router = express.Router();
const Payroll = require('../models/Payroll');
const Employee = require('../models/Employee');
const { auth, authorize } = require('../middleware/auth');
const { idValidation, payrollValidation, PAYROLL_STATUS } = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created, paginated } = require('../utils/response');
const { NotFoundError, BadRequestError, ConflictError, ForbiddenError } = require('../utils/errors');
const { generatePayslipPDF } = require('../utils/pdfGenerator');

// @route   GET /api/payroll/stats/summary
// @desc    Get payroll statistics
// @access  Private (Admin, HR)
router.get('/stats/summary', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();

  const [monthlyStats, statusCounts, departmentStats] = await Promise.all([
    Payroll.aggregate([
      { $match: { 'period.year': year, status: 'paid' } },
      {
        $group: {
          _id: '$period.month',
          totalGross: { $sum: '$grossPay' },
          totalNet: { $sum: '$netPay' },
          totalDeductions: { $sum: '$totalDeductions' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Payroll.aggregate([
      { $match: { 'period.year': year } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Payroll.aggregate([
      { $match: { 'period.year': year, status: 'paid' } },
      {
        $lookup: {
          from: 'employees',
          localField: 'employee',
          foreignField: '_id',
          as: 'employeeData',
        },
      },
      { $unwind: '$employeeData' },
      {
        $group: {
          _id: '$employeeData.department',
          totalGross: { $sum: '$grossPay' },
          totalNet: { $sum: '$netPay' },
          count: { $sum: 1 },
        },
      },
      { $sort: { totalNet: -1 } },
    ]),
  ]);

  const currentMonth = new Date().getMonth() + 1;
  const currentMonthStats = await Payroll.aggregate([
    { $match: { 'period.year': year, 'period.month': currentMonth } },
    {
      $group: {
        _id: null,
        totalGross: { $sum: '$grossPay' },
        totalNet: { $sum: '$netPay' },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
        approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
        paid: { $sum: { $cond: [{ $eq: ['$status', 'paid'] }, 1, 0] } },
        count: { $sum: 1 },
      },
    },
  ]);

  success(res, {
    year,
    monthly: monthlyStats,
    statusCounts,
    departmentStats,
    currentMonth: currentMonthStats[0] || { totalGross: 0, totalNet: 0, count: 0 },
  });
}));

// @route   GET /api/payroll/my-payslips
// @desc    Get employee's own payslips
// @access  Private
router.get('/my-payslips', auth, catchAsync(async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user._id });

  if (!employee) {
    throw new NotFoundError('Employee profile');
  }

  const { year } = req.query;
  const query = {
    employee: employee._id,
    status: 'paid',
  };

  if (year) {
    query['period.year'] = parseInt(year);
  }

  const payslips = await Payroll.find(query)
    .sort({ 'period.year': -1, 'period.month': -1 })
    .limit(24)
    .lean();

  // Calculate year-to-date totals
  const currentYear = new Date().getFullYear();
  const ytdPayslips = payslips.filter(p => p.period.year === currentYear);
  const ytdTotals = {
    grossPay: ytdPayslips.reduce((sum, p) => sum + (p.grossPay || 0), 0),
    netPay: ytdPayslips.reduce((sum, p) => sum + (p.netPay || 0), 0),
    deductions: ytdPayslips.reduce((sum, p) => sum + (p.totalDeductions || 0), 0),
  };

  success(res, { payslips, ytdTotals });
}));

// @route   GET /api/payroll/export/csv
// @desc    Export payroll to CSV
// @access  Private (Admin, HR)
router.get('/export/csv', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const { month, year, status } = req.query;
  const query = {};

  if (month) { query['period.month'] = parseInt(month); }
  if (year) { query['period.year'] = parseInt(year); }
  if (status) { query.status = status; }

  const payrolls = await Payroll.find(query)
    .populate('employee', 'name employeeId department position email')
    .sort({ 'employee.name': 1 })
    .lean();

  const headers = [
    'Employee ID', 'Employee Name', 'Department', 'Position', 'Email',
    'Period', 'Basic Salary', 'Allowance', 'Transport', 'Meal',
    'Overtime', 'Bonus', 'Tax', 'BPJS', 'Loan', 'Absence',
    'Other Deductions', 'Gross Pay', 'Total Deductions', 'Net Pay',
    'Status', 'Payment Method',
  ];

  const rows = payrolls.map(p => {
    const earnings = p.earnings || {};
    const deductions = p.deductions || {};
    return [
      p.employee?.employeeId || '',
      p.employee?.name || '',
      p.employee?.department || '',
      p.employee?.position || '',
      p.employee?.email || '',
      `${p.period.month}/${p.period.year}`,
      p.basicSalary || 0,
      earnings.allowance || 0,
      earnings.transport || 0,
      earnings.meal || 0,
      earnings.overtime || 0,
      earnings.bonus || 0,
      deductions.tax || 0,
      deductions.bpjs || 0,
      deductions.loan || 0,
      deductions.absence || 0,
      deductions.other || 0,
      p.grossPay || 0,
      p.totalDeductions || 0,
      p.netPay || 0,
      p.status || 'draft',
      p.paymentMethod || 'bank_transfer',
    ];
  });

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell =>
      typeof cell === 'string' && cell.includes(',')
        ? `"${cell}"`
        : cell,
    ).join(',')),
  ].join('\n');

  const filename = `payroll_${month || 'all'}_${year || 'all'}_${Date.now()}.csv`;
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csvContent);
}));

// @route   GET /api/payroll
// @desc    Get all payroll records
// @access  Private (Admin, HR)
router.get('/', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const { month, year, status, department, page = 1, limit = 20 } = req.query;
  const query = {};

  if (month) { query['period.month'] = parseInt(month); }
  if (year) { query['period.year'] = parseInt(year); }
  if (status && PAYROLL_STATUS.includes(status)) { query.status = status; }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  let payrolls = await Payroll.find(query)
    .populate('employee', 'name employeeId department position')
    .populate('processedBy', 'email')
    .populate('approvedBy', 'email')
    .sort({ 'period.year': -1, 'period.month': -1, createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .lean();

  // Filter by department if specified
  if (department) {
    payrolls = payrolls.filter(p => p.employee?.department === department);
  }

  const total = await Payroll.countDocuments(query);

  paginated(res, payrolls, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/payroll/:id
// @desc    Get single payroll record
// @access  Private
router.get('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id)
    .populate('employee', 'name employeeId department position email phone bankDetails')
    .populate('processedBy', 'email')
    .populate('approvedBy', 'email')
    .lean();

  if (!payroll) {
    throw new NotFoundError('Payroll record');
  }

  // Check access for employees
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee || payroll.employee._id.toString() !== employee._id.toString()) {
      throw new ForbiddenError('You can only view your own payslips');
    }
  }

  success(res, payroll);
}));

// @route   GET /api/payroll/:id/download
// @desc    Download payslip PDF
// @access  Private
router.get('/:id/download', auth, idValidation, catchAsync(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id)
    .populate('employee', 'name employeeId department position')
    .lean();

  if (!payroll) {
    throw new NotFoundError('Payroll record');
  }

  // Check access
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee || !payroll.employee || payroll.employee._id.toString() !== employee._id.toString()) {
      throw new ForbiddenError('You can only download your own payslips');
    }
  }

  const employeeName = payroll.employee?.name || 'Unknown';
  const filename = `Payslip_${employeeName.replace(/\s+/g, '_')}_${payroll.period.month}_${payroll.period.year}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  generatePayslipPDF(payroll, payroll.employee || { name: 'Unknown', employeeId: 'N/A', department: 'N/A', position: 'N/A' }, res);
}));

// @route   POST /api/payroll
// @desc    Create payroll record
// @access  Private (Admin, HR)
router.post('/', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const { employeeId, month, year, earnings, deductions, workingDays, overtimeHours, notes } = req.body;

  if (!employeeId || !month || !year) {
    throw new BadRequestError('Employee ID, month, and year are required');
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    throw new NotFoundError('Employee');
  }

  // Check if payroll already exists for this period
  const existing = await Payroll.findOne({
    employee: employeeId,
    'period.month': month,
    'period.year': year,
  });

  if (existing) {
    throw new ConflictError('Payroll already exists for this period');
  }

  const payroll = new Payroll({
    employee: employeeId,
    period: { month, year },
    basicSalary: employee.salary,
    earnings: earnings || {},
    deductions: deductions || {},
    workingDays: workingDays || { expected: 22, actual: 22 },
    overtimeHours: overtimeHours || 0,
    notes,
    processedBy: req.user._id,
  });

  await payroll.save();

  const populatedPayroll = await Payroll.findById(payroll._id)
    .populate('employee', 'name employeeId department')
    .lean();

  created(res, populatedPayroll, 'Payroll record created successfully');
}));

// @route   POST /api/payroll/generate-batch
// @desc    Generate payroll for all active employees
// @access  Private (Admin)
router.post('/generate-batch', auth, authorize('admin'), catchAsync(async (req, res) => {
  const { month, year, department } = req.body;

  if (!month || !year) {
    throw new BadRequestError('Month and year are required');
  }

  const employeeQuery = { status: 'active' };
  if (department) { employeeQuery.department = department; }

  const activeEmployees = await Employee.find(employeeQuery);
  const results = { created: [], skipped: [], errors: [] };

  for (const employee of activeEmployees) {
    try {
      const existing = await Payroll.findOne({
        employee: employee._id,
        'period.month': month,
        'period.year': year,
      });

      if (existing) {
        results.skipped.push({ name: employee.name, reason: 'Already exists' });
        continue;
      }

      const payroll = new Payroll({
        employee: employee._id,
        period: { month, year },
        basicSalary: employee.salary,
        processedBy: req.user._id,
      });

      await payroll.save();
      results.created.push(employee.name);
    } catch (error) {
      results.errors.push({ name: employee.name, error: error.message });
    }
  }

  success(res, {
    message: `Generated ${results.created.length} payroll records`,
    ...results,
  });
}));

// @route   PUT /api/payroll/:id
// @desc    Update payroll
// @access  Private (Admin, HR)
router.put('/:id', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id);

  if (!payroll) {
    throw new NotFoundError('Payroll record');
  }

  if (payroll.status === 'paid') {
    throw new BadRequestError('Cannot modify paid payroll records');
  }

  const allowedUpdates = ['basicSalary', 'earnings', 'deductions', 'workingDays', 'overtimeHours', 'notes', 'paymentMethod', 'bankDetails'];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      payroll[field] = req.body[field];
    }
  });

  await payroll.save();

  const populatedPayroll = await Payroll.findById(payroll._id)
    .populate('employee', 'name employeeId department')
    .lean();

  success(res, populatedPayroll, 'Payroll record updated successfully');
}));

// @route   PUT /api/payroll/:id/approve
// @desc    Approve payroll
// @access  Private (Admin)
router.put('/:id/approve', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id);

  if (!payroll) {
    throw new NotFoundError('Payroll record');
  }

  if (payroll.status !== 'pending') {
    throw new BadRequestError(`Cannot approve payroll with status: ${payroll.status}`);
  }

  payroll.status = 'approved';
  payroll.approvedBy = req.user._id;
  payroll.approvedAt = new Date();
  await payroll.save();

  const populatedPayroll = await Payroll.findById(payroll._id)
    .populate('employee', 'name employeeId department')
    .lean();

  success(res, populatedPayroll, 'Payroll approved successfully');
}));

// @route   PUT /api/payroll/:id/pay
// @desc    Mark payroll as paid
// @access  Private (Admin)
router.put('/:id/pay', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id);

  if (!payroll) {
    throw new NotFoundError('Payroll record');
  }

  if (payroll.status !== 'approved') {
    throw new BadRequestError('Payroll must be approved before marking as paid');
  }

  payroll.status = 'paid';
  payroll.paidAt = new Date();
  payroll.paymentReference = req.body.paymentReference || `PAY-${Date.now()}`;
  await payroll.save();

  const populatedPayroll = await Payroll.findById(payroll._id)
    .populate('employee', 'name employeeId department')
    .lean();

  success(res, populatedPayroll, 'Payroll marked as paid');
}));

// @route   PUT /api/payroll/batch/approve
// @desc    Approve multiple payrolls
// @access  Private (Admin)
router.put('/batch/approve', auth, authorize('admin'), catchAsync(async (req, res) => {
  const { payrollIds } = req.body;

  if (!payrollIds || !Array.isArray(payrollIds) || payrollIds.length === 0) {
    throw new BadRequestError('Payroll IDs array is required');
  }

  const results = { approved: [], skipped: [], errors: [] };

  for (const id of payrollIds) {
    try {
      const payroll = await Payroll.findById(id);
      if (!payroll) {
        results.errors.push({ id, error: 'Not found' });
        continue;
      }
      if (payroll.status !== 'pending') {
        results.skipped.push({ id, reason: `Status is ${payroll.status}` });
        continue;
      }

      payroll.status = 'approved';
      payroll.approvedBy = req.user._id;
      payroll.approvedAt = new Date();
      await payroll.save();
      results.approved.push(id);
    } catch (error) {
      results.errors.push({ id, error: error.message });
    }
  }

  success(res, {
    message: `Approved ${results.approved.length} payroll records`,
    ...results,
  });
}));

// @route   DELETE /api/payroll/:id
// @desc    Delete payroll
// @access  Private (Admin)
router.delete('/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const payroll = await Payroll.findById(req.params.id);

  if (!payroll) {
    throw new NotFoundError('Payroll record');
  }

  if (payroll.status === 'paid') {
    throw new BadRequestError('Cannot delete paid payroll records');
  }

  await Payroll.findByIdAndDelete(req.params.id);

  success(res, null, 'Payroll record deleted');
}));

module.exports = router;
