/**
 * Settings Routes
 * Type-safe application settings management
 */

const express = require('express');
const router = express.Router();
const Settings = require('../models/Settings');
const { auth, authorize } = require('../middleware/auth');
const { settingsValidation, idValidation } = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created } = require('../utils/response');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');

// @route   GET /api/settings
// @desc    Get application settings
// @access  Private
router.get('/', auth, catchAsync(async (req, res) => {
  const settings = await Settings.getSettings();
  success(res, settings);
}));

// @route   PUT /api/settings
// @desc    Update settings (admin only)
// @access  Private (Admin)
router.put('/', auth, authorize('admin'), settingsValidation, catchAsync(async (req, res) => {
  const settings = await Settings.getSettings();

  const allowedUpdates = [
    'companyName', 'companyLogo', 'companyAddress', 'companyEmail', 'companyPhone',
    'workSchedule', 'leavePolicy', 'payrollSettings',
    'holidays', 'departments', 'positions', 'notifications',
    'timezone', 'dateFormat', 'currency',
  ];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      settings[field] = req.body[field];
    }
  });

  settings.updatedBy = req.user._id;
  await settings.save();

  success(res, settings, 'Settings updated successfully');
}));

// @route   POST /api/settings/holidays
// @desc    Add a holiday
// @access  Private (Admin)
router.post('/holidays', auth, authorize('admin'), catchAsync(async (req, res) => {
  const { name, date, isRecurring = false, type = 'public' } = req.body;

  if (!name || !date) {
    throw new BadRequestError('Name and date are required');
  }

  const holidayDate = new Date(date);
  if (isNaN(holidayDate.getTime())) {
    throw new BadRequestError('Invalid date format');
  }

  const settings = await Settings.getSettings();

  // Check for duplicate holiday on same date
  const existingHoliday = settings.holidays.find(h =>
    h.date.toDateString() === holidayDate.toDateString(),
  );

  if (existingHoliday) {
    throw new ConflictError('A holiday already exists on this date');
  }

  settings.holidays.push({
    name,
    date: holidayDate,
    isRecurring,
    type,
  });

  // Sort holidays by date
  settings.holidays.sort((a, b) => a.date - b.date);

  await settings.save();

  created(res, settings.holidays, 'Holiday added successfully');
}));

// @route   PUT /api/settings/holidays/:id
// @desc    Update a holiday
// @access  Private (Admin)
router.put('/holidays/:id', auth, authorize('admin'), catchAsync(async (req, res) => {
  const { name, date, isRecurring, type } = req.body;

  const settings = await Settings.getSettings();
  const holiday = settings.holidays.id(req.params.id);

  if (!holiday) {
    throw new NotFoundError('Holiday');
  }

  if (name) {holiday.name = name;}
  if (date) {holiday.date = new Date(date);}
  if (isRecurring !== undefined) {holiday.isRecurring = isRecurring;}
  if (type) {holiday.type = type;}

  await settings.save();

  success(res, holiday, 'Holiday updated successfully');
}));

// @route   DELETE /api/settings/holidays/:id
// @desc    Remove a holiday
// @access  Private (Admin)
router.delete('/holidays/:id', auth, authorize('admin'), catchAsync(async (req, res) => {
  const settings = await Settings.getSettings();

  const holidayIndex = settings.holidays.findIndex(
    h => h._id.toString() === req.params.id,
  );

  if (holidayIndex === -1) {
    throw new NotFoundError('Holiday');
  }

  settings.holidays.splice(holidayIndex, 1);
  await settings.save();

  success(res, null, 'Holiday removed successfully');
}));

// @route   GET /api/settings/holidays
// @desc    Get all holidays
// @access  Private
router.get('/holidays', auth, catchAsync(async (req, res) => {
  const settings = await Settings.getSettings();
  const { year } = req.query;

  let holidays = settings.holidays;

  // Filter by year if specified
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
  const { name, description, managerId } = req.body;

  if (!name) {
    throw new BadRequestError('Department name is required');
  }

  const settings = await Settings.getSettings();

  if (settings.departments.includes(name)) {
    throw new ConflictError('Department already exists');
  }

  settings.departments.push(name);
  settings.departments.sort(); // Keep alphabetically sorted
  await settings.save();

  created(res, settings.departments, 'Department added successfully');
}));

// @route   DELETE /api/settings/departments/:name
// @desc    Remove a department
// @access  Private (Admin)
router.delete('/departments/:name', auth, authorize('admin'), catchAsync(async (req, res) => {
  const settings = await Settings.getSettings();
  const departmentName = decodeURIComponent(req.params.name);

  const index = settings.departments.indexOf(departmentName);
  if (index === -1) {
    throw new NotFoundError('Department');
  }

  settings.departments.splice(index, 1);
  await settings.save();

  success(res, null, 'Department removed successfully');
}));

// @route   GET /api/settings/departments
// @desc    Get all departments
// @access  Private
router.get('/departments', auth, catchAsync(async (req, res) => {
  const settings = await Settings.getSettings();
  success(res, settings.departments);
}));

// @route   POST /api/settings/positions
// @desc    Add a position
// @access  Private (Admin)
router.post('/positions', auth, authorize('admin'), catchAsync(async (req, res) => {
  const { name, department, level } = req.body;

  if (!name) {
    throw new BadRequestError('Position name is required');
  }

  const settings = await Settings.getSettings();

  if (settings.positions && settings.positions.includes(name)) {
    throw new ConflictError('Position already exists');
  }

  if (!settings.positions) {settings.positions = [];}
  settings.positions.push(name);
  settings.positions.sort();
  await settings.save();

  created(res, settings.positions, 'Position added successfully');
}));

// @route   DELETE /api/settings/positions/:name
// @desc    Remove a position
// @access  Private (Admin)
router.delete('/positions/:name', auth, authorize('admin'), catchAsync(async (req, res) => {
  const settings = await Settings.getSettings();
  const positionName = decodeURIComponent(req.params.name);

  if (!settings.positions) {
    throw new NotFoundError('Position');
  }

  const index = settings.positions.indexOf(positionName);
  if (index === -1) {
    throw new NotFoundError('Position');
  }

  settings.positions.splice(index, 1);
  await settings.save();

  success(res, null, 'Position removed successfully');
}));

// @route   GET /api/settings/work-schedule
// @desc    Get work schedule settings
// @access  Private
router.get('/work-schedule', auth, catchAsync(async (req, res) => {
  const settings = await Settings.getSettings();
  success(res, settings.workSchedule || {
    startTime: '09:00',
    endTime: '17:00',
    workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    breakDuration: 60,
  });
}));

// @route   PUT /api/settings/work-schedule
// @desc    Update work schedule
// @access  Private (Admin)
router.put('/work-schedule', auth, authorize('admin'), catchAsync(async (req, res) => {
  const { startTime, endTime, workingDays, breakDuration } = req.body;

  const settings = await Settings.getSettings();

  if (!settings.workSchedule) {settings.workSchedule = {};}

  if (startTime) {settings.workSchedule.startTime = startTime;}
  if (endTime) {settings.workSchedule.endTime = endTime;}
  if (workingDays) {settings.workSchedule.workingDays = workingDays;}
  if (breakDuration) {settings.workSchedule.breakDuration = breakDuration;}

  await settings.save();

  success(res, settings.workSchedule, 'Work schedule updated successfully');
}));

// @route   GET /api/settings/leave-policy
// @desc    Get leave policy
// @access  Private
router.get('/leave-policy', auth, catchAsync(async (req, res) => {
  const settings = await Settings.getSettings();
  success(res, settings.leavePolicy || {
    annual: 12,
    sick: 10,
    personal: 3,
    maternity: 90,
    paternity: 14,
  });
}));

// @route   PUT /api/settings/leave-policy
// @desc    Update leave policy
// @access  Private (Admin)
router.put('/leave-policy', auth, authorize('admin'), catchAsync(async (req, res) => {
  const settings = await Settings.getSettings();
  settings.leavePolicy = { ...settings.leavePolicy, ...req.body };
  await settings.save();

  success(res, settings.leavePolicy, 'Leave policy updated successfully');
}));

module.exports = router;
