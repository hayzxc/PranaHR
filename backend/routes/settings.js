/**
 * Settings Routes
 * Type-safe application settings management
 * PONYTAIL FIX: Prisma Integration & Singleton Pattern
 */

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma').default;
const { auth, authorize } = require('../middleware/auth');
const { settingsValidation } = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created } = require('../utils/response');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');

// Helper to get or create singleton settings
const getSettings = async () => {
  let settings = await prisma.settings.findUnique({ where: { id: 'singleton' } });
  if (!settings) {
    settings = await prisma.settings.create({
      data: {
        id: 'singleton',
        holidays: [],
        departments: ["Engineering", "HR", "Finance", "Marketing", "Operations", "Sales", "IT", "Admin"],
        positions: ["Manager", "Senior", "Junior", "Intern", "Director", "Executive"],
        workSchedule: { startTime: '09:00', endTime: '17:00', workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], breakDuration: 60 },
        leavePolicy: { annual: 12, sick: 10, personal: 3, maternity: 90, paternity: 14 }
      }
    });
  }
  return settings;
};

// @route   GET /api/settings
// @desc    Get application settings
// @access  Private
router.get('/', auth, catchAsync(async (req, res) => {
  const settings = await getSettings();
  success(res, settings);
}));

// @route   PUT /api/settings
// @desc    Update settings (admin only)
// @access  Private (Admin)
router.put('/', auth, authorize('admin'), settingsValidation, catchAsync(async (req, res) => {
  await getSettings(); // ensure exists

  const data = {};
  const allowed = ['companyName', 'companyLogo', 'address', 'workSchedule', 'leavePolicy', 'payrollSettings', 'notifications', 'departments', 'positions'];

  allowed.forEach(field => {
    if (req.body[field] !== undefined) {
      data[field] = req.body[field];
    }
  });

  const updatedSettings = await prisma.settings.update({
    where: { id: 'singleton' },
    data
  });

  success(res, updatedSettings, 'Settings updated successfully');
}));

// @route   POST /api/settings/holidays
// @desc    Add a holiday
// @access  Private (Admin)
router.post('/holidays', auth, authorize('admin'), catchAsync(async (req, res) => {
  const { name, date, isRecurring = false, type = 'public' } = req.body;

  if (!name || !date) throw new BadRequestError('Name and date are required');

  const holidayDate = new Date(date);
  if (isNaN(holidayDate.getTime())) throw new BadRequestError('Invalid date format');

  const settings = await getSettings();
  const holidays = Array.isArray(settings.holidays) ? [...settings.holidays] : [];

  const existingHoliday = holidays.find(h => new Date(h.date).toDateString() === holidayDate.toDateString());
  if (existingHoliday) throw new ConflictError('A holiday already exists on this date');

  holidays.push({
    id: `hol_${Date.now()}`,
    name,
    date: holidayDate.toISOString(),
    isRecurring,
    type,
  });

  holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

  const updatedSettings = await prisma.settings.update({
    where: { id: 'singleton' },
    data: { holidays }
  });

  created(res, updatedSettings.holidays, 'Holiday added successfully');
}));

// @route   PUT /api/settings/holidays/:id
// @desc    Update a holiday
// @access  Private (Admin)
router.put('/holidays/:id', auth, authorize('admin'), catchAsync(async (req, res) => {
  const { name, date, isRecurring, type } = req.body;

  const settings = await getSettings();
  const holidays = Array.isArray(settings.holidays) ? [...settings.holidays] : [];

  const index = holidays.findIndex(h => h.id === req.params.id || h._id === req.params.id);
  if (index === -1) throw new NotFoundError('Holiday');

  if (name) holidays[index].name = name;
  if (date) holidays[index].date = new Date(date).toISOString();
  if (isRecurring !== undefined) holidays[index].isRecurring = isRecurring;
  if (type) holidays[index].type = type;

  holidays.sort((a, b) => new Date(a.date) - new Date(b.date));

  await prisma.settings.update({
    where: { id: 'singleton' },
    data: { holidays }
  });

  success(res, holidays[index], 'Holiday updated successfully');
}));

// @route   DELETE /api/settings/holidays/:id
// @desc    Remove a holiday
// @access  Private (Admin)
router.delete('/holidays/:id', auth, authorize('admin'), catchAsync(async (req, res) => {
  const settings = await getSettings();
  const holidays = Array.isArray(settings.holidays) ? [...settings.holidays] : [];

  const filtered = holidays.filter(h => h.id !== req.params.id && h._id !== req.params.id);
  if (filtered.length === holidays.length) throw new NotFoundError('Holiday');

  await prisma.settings.update({
    where: { id: 'singleton' },
    data: { holidays: filtered }
  });

  success(res, null, 'Holiday removed successfully');
}));

// @route   GET /api/settings/holidays
// @desc    Get all holidays
// @access  Private
router.get('/holidays', auth, catchAsync(async (req, res) => {
  const settings = await getSettings();
  const { year } = req.query;

  let holidays = Array.isArray(settings.holidays) ? settings.holidays : [];

  if (year) {
    const yearNum = parseInt(year);
    holidays = holidays.filter(h => {
      const holidayYear = new Date(h.date).getFullYear();
      return holidayYear === yearNum || h.isRecurring;
    });
  }

  success(res, holidays);
}));

// @route   POST /api/settings/departments
// @desc    Add a department
// @access  Private (Admin)
router.post('/departments', auth, authorize('admin'), catchAsync(async (req, res) => {
  const { name } = req.body;
  if (!name) throw new BadRequestError('Department name is required');

  const settings = await getSettings();
  const departments = [...settings.departments];

  if (departments.includes(name)) throw new ConflictError('Department already exists');

  departments.push(name);
  departments.sort();

  await prisma.settings.update({
    where: { id: 'singleton' },
    data: { departments }
  });

  created(res, departments, 'Department added successfully');
}));

// @route   DELETE /api/settings/departments/:name
// @desc    Remove a department
// @access  Private (Admin)
router.delete('/departments/:name', auth, authorize('admin'), catchAsync(async (req, res) => {
  const settings = await getSettings();
  const departmentName = decodeURIComponent(req.params.name);

  const departments = [...settings.departments];
  const index = departments.indexOf(departmentName);
  
  if (index === -1) throw new NotFoundError('Department');

  departments.splice(index, 1);

  await prisma.settings.update({
    where: { id: 'singleton' },
    data: { departments }
  });

  success(res, null, 'Department removed successfully');
}));

// @route   GET /api/settings/departments
// @desc    Get all departments
// @access  Private
router.get('/departments', auth, catchAsync(async (req, res) => {
  const settings = await getSettings();
  success(res, settings.departments);
}));

// @route   POST /api/settings/positions
// @desc    Add a position
// @access  Private (Admin)
router.post('/positions', auth, authorize('admin'), catchAsync(async (req, res) => {
  const { name } = req.body;
  if (!name) throw new BadRequestError('Position name is required');

  const settings = await getSettings();
  const positions = [...settings.positions];

  if (positions.includes(name)) throw new ConflictError('Position already exists');

  positions.push(name);
  positions.sort();

  await prisma.settings.update({
    where: { id: 'singleton' },
    data: { positions }
  });

  created(res, positions, 'Position added successfully');
}));

// @route   DELETE /api/settings/positions/:name
// @desc    Remove a position
// @access  Private (Admin)
router.delete('/positions/:name', auth, authorize('admin'), catchAsync(async (req, res) => {
  const settings = await getSettings();
  const positionName = decodeURIComponent(req.params.name);

  const positions = [...settings.positions];
  const index = positions.indexOf(positionName);
  
  if (index === -1) throw new NotFoundError('Position');

  positions.splice(index, 1);

  await prisma.settings.update({
    where: { id: 'singleton' },
    data: { positions }
  });

  success(res, null, 'Position removed successfully');
}));

// @route   GET /api/settings/work-schedule
// @desc    Get work schedule settings
// @access  Private
router.get('/work-schedule', auth, catchAsync(async (req, res) => {
  const settings = await getSettings();
  success(res, settings.workSchedule || {
    startTime: '09:00', endTime: '17:00', workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], breakDuration: 60
  });
}));

// @route   PUT /api/settings/work-schedule
// @desc    Update work schedule
// @access  Private (Admin)
router.put('/work-schedule', auth, authorize('admin'), catchAsync(async (req, res) => {
  const settings = await getSettings();
  const workSchedule = { ...(settings.workSchedule || {}) };

  const allowed = ['startTime', 'endTime', 'workingDays', 'breakDuration'];
  allowed.forEach(f => {
    if (req.body[f] !== undefined) workSchedule[f] = req.body[f];
  });

  await prisma.settings.update({
    where: { id: 'singleton' },
    data: { workSchedule }
  });

  success(res, workSchedule, 'Work schedule updated successfully');
}));

// @route   GET /api/settings/leave-policy
// @desc    Get leave policy
// @access  Private
router.get('/leave-policy', auth, catchAsync(async (req, res) => {
  const settings = await getSettings();
  success(res, settings.leavePolicy || {
    annual: 12, sick: 10, personal: 3, maternity: 90, paternity: 14
  });
}));

// @route   PUT /api/settings/leave-policy
// @desc    Update leave policy
// @access  Private (Admin)
router.put('/leave-policy', auth, authorize('admin'), catchAsync(async (req, res) => {
  const settings = await getSettings();
  const leavePolicy = { ...(settings.leavePolicy || {}), ...req.body };

  await prisma.settings.update({
    where: { id: 'singleton' },
    data: { leavePolicy }
  });

  success(res, leavePolicy, 'Leave policy updated successfully');
}));

module.exports = router;
