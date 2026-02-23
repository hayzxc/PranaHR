/**
 * Onboarding Routes
 * Type-safe employee onboarding management
 */

const express = require('express');
const router = express.Router();
const Onboarding = require('../models/Onboarding');
const Employee = require('../models/Employee');
const { auth, authorize } = require('../middleware/auth');
const { idValidation, onboardingTaskValidation, TASK_STATUS } = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created, paginated } = require('../utils/response');
const { NotFoundError, ForbiddenError, BadRequestError, ConflictError } = require('../utils/errors');

// @route   GET /api/onboarding/stats/summary
// @desc    Get onboarding statistics
// @access  Private (Admin, HR)
router.get('/stats/summary', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const [statusCounts, avgProgress, avgFeedback, recentOnboardings] = await Promise.all([
    Onboarding.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    Onboarding.aggregate([
      { $match: { status: { $ne: 'completed' } } },
      { $group: { _id: null, avgProgress: { $avg: '$progress' } } },
    ]),
    Onboarding.aggregate([
      { $match: { 'feedback.rating': { $exists: true } } },
      { $group: { _id: null, avgRating: { $avg: '$feedback.rating' } } },
    ]),
    Onboarding.find({ status: 'in_progress' })
      .populate('employee', 'name department')
      .sort({ startDate: -1 })
      .limit(5)
      .lean(),
  ]);

  success(res, {
    statusCounts,
    avgProgress: Math.round((avgProgress[0]?.avgProgress || 0) * 100) / 100,
    avgFeedbackRating: Math.round((avgFeedback[0]?.avgRating || 0) * 10) / 10,
    recentOnboardings,
  });
}));

// @route   GET /api/onboarding/templates/default
// @desc    Get default tasks template
// @access  Private (Admin, HR)
router.get('/templates/default', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const tasks = Onboarding.getDefaultTasks();
  success(res, tasks);
}));

// @route   GET /api/onboarding/my-onboarding
// @desc    Get current user's onboarding
// @access  Private
router.get('/my-onboarding', auth, catchAsync(async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user._id });

  if (!employee) {
    throw new NotFoundError('Employee profile');
  }

  const onboarding = await Onboarding.findOne({ employee: employee._id })
    .populate('mentor', 'name email department position')
    .populate('tasks.completedBy', 'email')
    .lean();

  if (!onboarding) {
    throw new NotFoundError('Onboarding record');
  }

  // Calculate task summary
  const taskSummary = {
    total: onboarding.tasks.length,
    completed: onboarding.tasks.filter(t => t.completed).length,
    pending: onboarding.tasks.filter(t => !t.completed).length,
    overdue: onboarding.tasks.filter(t => !t.completed && new Date(t.dueDate) < new Date()).length,
  };

  success(res, { ...onboarding, taskSummary });
}));

// @route   GET /api/onboarding
// @desc    Get all onboarding records
// @access  Private (Admin, HR)
router.get('/', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const { status, department, page = 1, limit = 10 } = req.query;
  const query = {};

  if (status) {query.status = status;}

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  let onboardings = await Onboarding.find(query)
    .populate('employee', 'name employeeId department position')
    .populate('mentor', 'name employeeId')
    .sort({ startDate: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .lean();

  // Filter by department if specified
  if (department) {
    onboardings = onboardings.filter(o => o.employee?.department === department);
  }

  const total = await Onboarding.countDocuments(query);

  paginated(res, onboardings, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/onboarding/:id
// @desc    Get single onboarding
// @access  Private
router.get('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const onboarding = await Onboarding.findById(req.params.id)
    .populate('employee', 'name employeeId department position email phone hireDate userId')
    .populate('mentor', 'name employeeId email')
    .populate('tasks.completedBy', 'email')
    .lean();

  if (!onboarding) {
    throw new NotFoundError('Onboarding');
  }

  // Check access for employees
  if (req.user.role === 'employee') {
    if (onboarding.employee.userId.toString() !== req.user._id.toString()) {
      throw new ForbiddenError('You can only view your own onboarding');
    }
  }

  success(res, onboarding);
}));

// @route   POST /api/onboarding
// @desc    Create onboarding for new employee
// @access  Private (Admin, HR)
router.post('/', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const { employeeId, startDate, mentorId, customTasks, notes } = req.body;

  if (!employeeId || !startDate) {
    throw new BadRequestError('Employee ID and start date are required');
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    throw new NotFoundError('Employee');
  }

  // Check if onboarding already exists
  const existing = await Onboarding.findOne({ employee: employeeId });
  if (existing) {
    throw new ConflictError('Onboarding already exists for this employee');
  }

  // Validate mentor if provided
  if (mentorId) {
    const mentor = await Employee.findById(mentorId);
    if (!mentor) {
      throw new NotFoundError('Mentor');
    }
  }

  // Get default tasks or use custom tasks
  const defaultTasks = Onboarding.getDefaultTasks();
  const tasksToCreate = customTasks || defaultTasks;

  // Calculate due dates based on start date
  const start = new Date(startDate);
  const tasks = tasksToCreate.map(task => ({
    title: task.title,
    description: task.description || '',
    category: task.category || 'general',
    assignedTo: task.assignedTo || 'employee',
    dueDate: new Date(start.getTime() + (task.dueInDays || 7) * 24 * 60 * 60 * 1000),
    completed: false,
    required: task.required !== false,
  }));

  const onboarding = new Onboarding({
    employee: employeeId,
    startDate: start,
    expectedEndDate: new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000),
    tasks,
    mentor: mentorId,
    notes,
  });

  await onboarding.save();

  const populatedOnboarding = await Onboarding.findById(onboarding._id)
    .populate('employee', 'name employeeId department')
    .populate('mentor', 'name')
    .lean();

  created(res, populatedOnboarding, 'Onboarding created successfully');
}));

// @route   PUT /api/onboarding/:id
// @desc    Update onboarding details
// @access  Private (Admin, HR)
router.put('/:id', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const onboarding = await Onboarding.findById(req.params.id);

  if (!onboarding) {
    throw new NotFoundError('Onboarding');
  }

  const allowedUpdates = ['mentor', 'expectedEndDate', 'notes', 'status'];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      onboarding[field] = req.body[field];
    }
  });

  // Handle status change
  if (req.body.status === 'completed' && onboarding.status !== 'completed') {
    onboarding.completedAt = new Date();
  }

  await onboarding.save();

  const populatedOnboarding = await Onboarding.findById(onboarding._id)
    .populate('employee', 'name employeeId')
    .lean();

  success(res, populatedOnboarding, 'Onboarding updated successfully');
}));

// @route   PUT /api/onboarding/:id/tasks/:taskId
// @desc    Update task status
// @access  Private
router.put('/:id/tasks/:taskId', auth, catchAsync(async (req, res) => {
  const onboarding = await Onboarding.findById(req.params.id);

  if (!onboarding) {
    throw new NotFoundError('Onboarding');
  }

  const task = onboarding.tasks.id(req.params.taskId);
  if (!task) {
    throw new NotFoundError('Task');
  }

  // Check access for employees - they can only update their own onboarding tasks
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee || onboarding.employee.toString() !== employee._id.toString()) {
      throw new ForbiddenError('You can only update your own onboarding tasks');
    }
  }

  if (req.body.completed !== undefined) {
    task.completed = req.body.completed;
    if (task.completed) {
      task.completedAt = new Date();
      task.completedBy = req.user._id;
    } else {
      task.completedAt = undefined;
      task.completedBy = undefined;
    }
  }

  if (req.body.notes !== undefined) {
    task.notes = req.body.notes;
  }

  // Recalculate progress
  const completedTasks = onboarding.tasks.filter(t => t.completed).length;
  onboarding.progress = Math.round((completedTasks / onboarding.tasks.length) * 100);

  // Auto-complete onboarding if all tasks done
  if (onboarding.progress === 100 && onboarding.status === 'in_progress') {
    onboarding.status = 'completed';
    onboarding.completedAt = new Date();
  }

  await onboarding.save();

  success(res, onboarding, 'Task updated successfully');
}));

// @route   POST /api/onboarding/:id/tasks
// @desc    Add task to onboarding
// @access  Private (Admin, HR)
router.post('/:id/tasks', auth, authorize('admin', 'hr'), idValidation, onboardingTaskValidation, catchAsync(async (req, res) => {
  const onboarding = await Onboarding.findById(req.params.id);

  if (!onboarding) {
    throw new NotFoundError('Onboarding');
  }

  const { title, description, category, assignedTo, dueDate, required } = req.body;

  if (!title) {
    throw new BadRequestError('Task title is required');
  }

  onboarding.tasks.push({
    title,
    description: description || '',
    category: category || 'general',
    assignedTo: assignedTo || 'employee',
    dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    completed: false,
    required: required !== false,
  });

  // Recalculate progress
  const completedTasks = onboarding.tasks.filter(t => t.completed).length;
  onboarding.progress = Math.round((completedTasks / onboarding.tasks.length) * 100);

  await onboarding.save();

  created(res, onboarding, 'Task added successfully');
}));

// @route   DELETE /api/onboarding/:id/tasks/:taskId
// @desc    Remove task from onboarding
// @access  Private (Admin, HR)
router.delete('/:id/tasks/:taskId', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const onboarding = await Onboarding.findById(req.params.id);

  if (!onboarding) {
    throw new NotFoundError('Onboarding');
  }

  const taskIndex = onboarding.tasks.findIndex(t => t._id.toString() === req.params.taskId);
  if (taskIndex === -1) {
    throw new NotFoundError('Task');
  }

  onboarding.tasks.splice(taskIndex, 1);

  // Recalculate progress
  if (onboarding.tasks.length > 0) {
    const completedTasks = onboarding.tasks.filter(t => t.completed).length;
    onboarding.progress = Math.round((completedTasks / onboarding.tasks.length) * 100);
  } else {
    onboarding.progress = 0;
  }

  await onboarding.save();

  success(res, onboarding, 'Task removed successfully');
}));

// @route   POST /api/onboarding/:id/feedback
// @desc    Submit onboarding feedback
// @access  Private
router.post('/:id/feedback', auth, idValidation, catchAsync(async (req, res) => {
  const onboarding = await Onboarding.findById(req.params.id);

  if (!onboarding) {
    throw new NotFoundError('Onboarding');
  }

  // Check access - only the employee can submit their own feedback
  const employee = await Employee.findOne({ userId: req.user._id });
  if (!employee || onboarding.employee.toString() !== employee._id.toString()) {
    // HR/Admin can also add feedback
    if (!['hr', 'admin'].includes(req.user.role)) {
      throw new ForbiddenError('You can only submit feedback for your own onboarding');
    }
  }

  const { rating, comments } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    throw new BadRequestError('Rating must be between 1 and 5');
  }

  onboarding.feedback = {
    rating,
    comments: comments || '',
    submittedAt: new Date(),
    submittedBy: employee?._id,
  };

  await onboarding.save();

  success(res, onboarding, 'Feedback submitted successfully');
}));

// @route   DELETE /api/onboarding/:id
// @desc    Delete onboarding record
// @access  Private (Admin)
router.delete('/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const onboarding = await Onboarding.findById(req.params.id);

  if (!onboarding) {
    throw new NotFoundError('Onboarding');
  }

  await Onboarding.findByIdAndDelete(req.params.id);

  success(res, null, 'Onboarding record deleted');
}));

module.exports = router;
