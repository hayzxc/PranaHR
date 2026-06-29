/**
 * Payroll Routes
 * Type-safe payroll management and processing
 * PONYTAIL FIX: Prisma ORM Integration & Strict Calculation logic
 */

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma').default;
const { auth, authorize } = require('../middleware/auth');
const { idValidation, payrollValidation, PAYROLL_STATUS } = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created, paginated } = require('../utils/response');
const { NotFoundError, BadRequestError, ConflictError, ForbiddenError } = require('../utils/errors');
const { generatePayslipPDF } = require('../utils/pdfGenerator');

const parseFloatSafe = (val) => {
  const parsed = parseFloat(val);
  return isNaN(parsed) ? 0 : parsed;
};

const calculatePayrollTotals = (basicSalary, earningsObj = {}, deductionsObj = {}) => {
  const e = {
    earnOvertime: parseFloatSafe(earningsObj.overtime),
    earnBonus: parseFloatSafe(earningsObj.bonus),
    earnAllowances: parseFloatSafe(earningsObj.allowance || earningsObj.allowances),
    earnTransport: parseFloatSafe(earningsObj.transport),
    earnMeal: parseFloatSafe(earningsObj.meal),
    earnOther: parseFloatSafe(earningsObj.other),
  };

  const d = {
    dedTax: parseFloatSafe(deductionsObj.tax),
    dedBpjs: parseFloatSafe(deductionsObj.bpjs),
    dedPension: parseFloatSafe(deductionsObj.pension),
    dedLoan: parseFloatSafe(deductionsObj.loan),
    dedAbsence: parseFloatSafe(deductionsObj.absence),
    dedOther: parseFloatSafe(deductionsObj.other),
  };

  const totalEarnings = Object.values(e).reduce((sum, val) => sum + val, 0);
  const totalDeductions = Object.values(d).reduce((sum, val) => sum + val, 0);
  
  const grossPay = parseFloatSafe(basicSalary) + totalEarnings;
  const netPay = grossPay - totalDeductions;

  return { ...e, ...d, grossPay, totalDeductions, netPay };
};

// @route   GET /api/payroll/stats/summary
// @desc    Get payroll statistics
// @access  Private (Admin, HR)
router.get('/stats/summary', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();

  const allPayrolls = await prisma.payroll.findMany({
    where: { periodYear: year },
    include: { employee: true }
  });

  const monthlyGroups = {};
  const statusGroups = {};
  const deptGroups = {};
  const currentMonth = new Date().getMonth() + 1;
  const currentMonthStats = { totalGross: 0, totalNet: 0, pending: 0, approved: 0, paid: 0, count: 0 };

  allPayrolls.forEach(p => {
    // Status Counts
    statusGroups[p.status] = (statusGroups[p.status] || 0) + 1;

    // Current Month Stats
    if (p.periodMonth === currentMonth) {
      currentMonthStats.totalGross += p.grossPay;
      currentMonthStats.totalNet += p.netPay;
      currentMonthStats.count++;
      if (p.status === 'pending') currentMonthStats.pending++;
      if (p.status === 'approved') currentMonthStats.approved++;
      if (p.status === 'paid') currentMonthStats.paid++;
    }

    // Monthly & Department Stats for paid payrolls
    if (p.status === 'paid') {
      // Monthly
      if (!monthlyGroups[p.periodMonth]) monthlyGroups[p.periodMonth] = { totalGross: 0, totalNet: 0, totalDeductions: 0, count: 0 };
      monthlyGroups[p.periodMonth].totalGross += p.grossPay;
      monthlyGroups[p.periodMonth].totalNet += p.netPay;
      monthlyGroups[p.periodMonth].totalDeductions += p.totalDeductions;
      monthlyGroups[p.periodMonth].count++;

      // Department
      if (p.employee && p.employee.department) {
        const dept = p.employee.department;
        if (!deptGroups[dept]) deptGroups[dept] = { totalGross: 0, totalNet: 0, count: 0 };
        deptGroups[dept].totalGross += p.grossPay;
        deptGroups[dept].totalNet += p.netPay;
        deptGroups[dept].count++;
      }
    }
  });

  const monthlyStats = Object.entries(monthlyGroups).map(([m, data]) => ({ _id: parseInt(m), ...data })).sort((a, b) => a._id - b._id);
  const statusCounts = Object.entries(statusGroups).map(([s, count]) => ({ _id: s, count }));
  const departmentStats = Object.entries(deptGroups).map(([d, data]) => ({ _id: d, ...data })).sort((a, b) => b.totalNet - a.totalNet);

  success(res, {
    year,
    monthly: monthlyStats,
    statusCounts,
    departmentStats,
    currentMonth: currentMonthStats,
  });
}));

// @route   GET /api/payroll/my-payslips
// @desc    Get employee's own payslips
// @access  Private
router.get('/my-payslips', auth, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });

  if (!employee) throw new NotFoundError('Employee profile');

  const { year } = req.query;
  const where = {
    employeeId: employee.id,
    status: 'paid',
  };

  if (year) where.periodYear = parseInt(year);

  const payslips = await prisma.payroll.findMany({
    where,
    orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
    take: 24,
  });

  const currentYear = new Date().getFullYear();
  const ytdPayslips = payslips.filter(p => p.periodYear === currentYear);
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
  const where = {};

  if (month) where.periodMonth = parseInt(month);
  if (year) where.periodYear = parseInt(year);
  if (status) where.status = status;

  const payrolls = await prisma.payroll.findMany({
    where,
    include: { employee: true },
    orderBy: { employee: { name: 'asc' } }
  });

  const headers = [
    'Employee ID', 'Employee Name', 'Department', 'Position', 'Email',
    'Period', 'Basic Salary', 'Allowance', 'Transport', 'Meal',
    'Overtime', 'Bonus', 'Tax', 'BPJS', 'Loan', 'Absence',
    'Other Deductions', 'Gross Pay', 'Total Deductions', 'Net Pay',
    'Status', 'Payment Method',
  ];

  const rows = payrolls.map(p => [
    p.employee?.employeeId || '',
    p.employee?.name || '',
    p.employee?.department || '',
    p.employee?.position || '',
    p.employee?.email || '',
    `${p.periodMonth}/${p.periodYear}`,
    p.basicSalary || 0,
    p.earnAllowances || 0,
    p.earnTransport || 0,
    p.earnMeal || 0,
    p.earnOvertime || 0,
    p.earnBonus || 0,
    p.dedTax || 0,
    p.dedBpjs || 0,
    p.dedLoan || 0,
    p.dedAbsence || 0,
    p.dedOther || 0,
    p.grossPay || 0,
    p.totalDeductions || 0,
    p.netPay || 0,
    p.status || 'draft',
    p.paymentMethod || 'bank_transfer',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell =>
      typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell,
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
  const where = {};

  if (month) where.periodMonth = parseInt(month);
  if (year) where.periodYear = parseInt(year);
  if (status && PAYROLL_STATUS.includes(status)) where.status = status;
  if (department) {
    const emps = await prisma.employee.findMany({ where: { department }, select: { id: true } });
    where.employeeId = { in: emps.map(e => e.id) };
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, payrolls] = await Promise.all([
    prisma.payroll.count({ where }),
    prisma.payroll.findMany({
      where,
      include: {
        employee: { select: { name: true, employeeId: true, department: true, position: true } },
        processedBy: { select: { email: true } },
        approvedBy: { select: { email: true } }
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { createdAt: 'desc' }],
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    })
  ]);

  paginated(res, payrolls, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/payroll/:id
// @desc    Get single payroll record
// @access  Private
router.get('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const payroll = await prisma.payroll.findUnique({
    where: { id: req.params.id },
    include: {
      employee: { select: { userId: true, name: true, employeeId: true, department: true, position: true, email: true, phone: true } },
      processedBy: { select: { email: true } },
      approvedBy: { select: { email: true } }
    }
  });

  if (!payroll) throw new NotFoundError('Payroll record');

  if (req.user.role === 'employee') {
    if (!payroll.employee || payroll.employee.userId !== req.user.id) {
      throw new ForbiddenError('You can only view your own payslips');
    }
  }

  success(res, payroll);
}));

// @route   GET /api/payroll/:id/download
// @desc    Download payslip PDF
// @access  Private
router.get('/:id/download', auth, idValidation, catchAsync(async (req, res) => {
  const payroll = await prisma.payroll.findUnique({
    where: { id: req.params.id },
    include: { employee: true }
  });

  if (!payroll) throw new NotFoundError('Payroll record');

  if (req.user.role === 'employee') {
    if (!payroll.employee || payroll.employee.userId !== req.user.id) {
      throw new ForbiddenError('You can only download your own payslips');
    }
  }

  // NOTE: Assuming generatePayslipPDF handles Prisma object structure directly
  const employeeName = payroll.employee?.name || 'Unknown';
  const filename = `Payslip_${employeeName.replace(/\s+/g, '_')}_${payroll.periodMonth}_${payroll.periodYear}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  generatePayslipPDF(payroll, payroll.employee || { name: 'Unknown', employeeId: 'N/A', department: 'N/A', position: 'N/A' }, res);
}));

// @route   POST /api/payroll
// @desc    Create payroll record
// @access  Private (Admin, HR)
router.post('/', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const { employeeId, month, year, earnings, deductions, workingDays, overtimeHours, notes } = req.body;

  if (!employeeId || !month || !year) throw new BadRequestError('Employee ID, month, and year are required');

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new NotFoundError('Employee');

  const existing = await prisma.payroll.findUnique({
    where: { employeeId_periodMonth_periodYear: { employeeId, periodMonth: month, periodYear: year } }
  });

  if (existing) throw new ConflictError('Payroll already exists for this period');

  const calculatedTotals = calculatePayrollTotals(employee.salary, earnings, deductions);

  const payroll = await prisma.payroll.create({
    data: {
      employeeId,
      periodMonth: month,
      periodYear: year,
      basicSalary: employee.salary,
      ...calculatedTotals,
      workExpected: workingDays?.expected || 22,
      workActual: workingDays?.actual || 22,
      overtimeHours: overtimeHours || 0,
      notes,
      processedById: req.user.id,
      status: 'pending' // PONYTAIL: Explicitly setting to pending instead of draft for safety
    },
    include: { employee: { select: { name: true, employeeId: true, department: true } } }
  });

  created(res, payroll, 'Payroll record created successfully');
}));

// @route   POST /api/payroll/generate-batch
// @desc    Generate payroll for all active employees
// @access  Private (Admin)
router.post('/generate-batch', auth, authorize('admin'), catchAsync(async (req, res) => {
  const { month, year, department } = req.body;

  if (!month || !year) throw new BadRequestError('Month and year are required');

  const where = { status: 'active' };
  if (department) where.department = department;

  const activeEmployees = await prisma.employee.findMany({ where });
  const results = { created: [], skipped: [], errors: [] };

  for (const employee of activeEmployees) {
    try {
      const existing = await prisma.payroll.findUnique({
        where: { employeeId_periodMonth_periodYear: { employeeId: employee.id, periodMonth: month, periodYear: year } }
      });

      if (existing) {
        results.skipped.push({ name: employee.name, reason: 'Already exists' });
        continue;
      }

      const calculatedTotals = calculatePayrollTotals(employee.salary);

      await prisma.payroll.create({
        data: {
          employeeId: employee.id,
          periodMonth: month,
          periodYear: year,
          basicSalary: employee.salary,
          ...calculatedTotals,
          processedById: req.user.id,
          status: 'pending'
        }
      });
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
  const payroll = await prisma.payroll.findUnique({ where: { id: req.params.id } });

  if (!payroll) throw new NotFoundError('Payroll record');
  if (payroll.status === 'paid') throw new BadRequestError('Cannot modify paid payroll records');

  // PONYTAIL FIX: Handle recalculations gracefully
  let dataToUpdate = {};
  
  if (req.body.basicSalary !== undefined || req.body.earnings !== undefined || req.body.deductions !== undefined) {
    // If any financial fields change, we must recalculate
    const base = req.body.basicSalary !== undefined ? req.body.basicSalary : payroll.basicSalary;
    // Map existing Prisma columns back to objects for the calculator if not provided
    const e = req.body.earnings || { 
      overtime: payroll.earnOvertime, bonus: payroll.earnBonus, allowance: payroll.earnAllowances,
      transport: payroll.earnTransport, meal: payroll.earnMeal, other: payroll.earnOther 
    };
    const d = req.body.deductions || {
      tax: payroll.dedTax, bpjs: payroll.dedBpjs, pension: payroll.dedPension,
      loan: payroll.dedLoan, absence: payroll.dedAbsence, other: payroll.dedOther
    };

    const recalculated = calculatePayrollTotals(base, e, d);
    dataToUpdate = { ...dataToUpdate, basicSalary: base, ...recalculated };
  }

  if (req.body.workingDays) {
    if (req.body.workingDays.expected !== undefined) dataToUpdate.workExpected = req.body.workingDays.expected;
    if (req.body.workingDays.actual !== undefined) dataToUpdate.workActual = req.body.workingDays.actual;
  }

  const standardFields = ['overtimeHours', 'notes', 'paymentMethod', 'bankName', 'accountNumber', 'accountName'];
  standardFields.forEach(field => {
    if (req.body[field] !== undefined) dataToUpdate[field] = req.body[field];
  });

  const updatedPayroll = await prisma.payroll.update({
    where: { id: req.params.id },
    data: dataToUpdate,
    include: { employee: { select: { name: true, employeeId: true, department: true } } }
  });

  success(res, updatedPayroll, 'Payroll record updated successfully');
}));

// @route   PUT /api/payroll/:id/approve
// @desc    Approve payroll
// @access  Private (Admin)
router.put('/:id/approve', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const payroll = await prisma.payroll.findUnique({ where: { id: req.params.id } });

  if (!payroll) throw new NotFoundError('Payroll record');
  if (payroll.status !== 'pending') throw new BadRequestError(`Cannot approve payroll with status: ${payroll.status}`);

  const updatedPayroll = await prisma.payroll.update({
    where: { id: req.params.id },
    data: { status: 'approved', approvedById: req.user.id, approvedAt: new Date() },
    include: { employee: { select: { name: true, employeeId: true, department: true } } }
  });

  success(res, updatedPayroll, 'Payroll approved successfully');
}));

// @route   PUT /api/payroll/:id/pay
// @desc    Mark payroll as paid
// @access  Private (Admin)
router.put('/:id/pay', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const payroll = await prisma.payroll.findUnique({ where: { id: req.params.id } });

  if (!payroll) throw new NotFoundError('Payroll record');
  if (payroll.status !== 'approved') throw new BadRequestError('Payroll must be approved before marking as paid');

  const updatedPayroll = await prisma.payroll.update({
    where: { id: req.params.id },
    data: { status: 'paid', paidAt: new Date() }, // Payment reference could be notes or a new field
    include: { employee: { select: { name: true, employeeId: true, department: true } } }
  });

  success(res, updatedPayroll, 'Payroll marked as paid');
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
      const payroll = await prisma.payroll.findUnique({ where: { id } });
      if (!payroll) {
        results.errors.push({ id, error: 'Not found' });
        continue;
      }
      if (payroll.status !== 'pending') {
        results.skipped.push({ id, reason: `Status is ${payroll.status}` });
        continue;
      }

      await prisma.payroll.update({
        where: { id },
        data: { status: 'approved', approvedById: req.user.id, approvedAt: new Date() }
      });
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
  const payroll = await prisma.payroll.findUnique({ where: { id: req.params.id } });

  if (!payroll) throw new NotFoundError('Payroll record');
  if (payroll.status === 'paid') throw new BadRequestError('Cannot delete paid payroll records');

  await prisma.payroll.delete({ where: { id: req.params.id } });

  success(res, null, 'Payroll record deleted');
}));

module.exports = router;
