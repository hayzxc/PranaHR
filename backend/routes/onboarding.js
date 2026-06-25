/**
 * Onboarding Routes
 * Type-safe employee onboarding management
 * PONYTAIL FIX: Prisma Integration & JSON Task Handling
 */

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma').default;
const { auth, authorize } = require('../middleware/auth');
const { idValidation, onboardingTaskValidation } = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created, paginated } = require('../utils/response');
const { NotFoundError, ForbiddenError, BadRequestError, ConflictError } = require('../utils/errors');

const getDefaultTasks = () => [
  { id: 't1', title: 'Welcome Email Sent', description: 'Send welcome email to new employee', category: 'general', assigneeId: 'hr', dueInDays: 0, required: true },
  { id: 't2', title: 'Workstation Setup', description: 'Set up desk, computer, and accounts', category: 'it', assigneeId: 'it', dueInDays: 1, required: true },
  { id: 't3', title: 'Company Overview', description: 'Meeting to explain company mission and culture', category: 'general', assigneeId: 'hr', dueInDays: 3, required: true },
  { id: 't4', title: 'Team Introduction', description: 'Introduce new employee to the team', category: 'department', assigneeId: 'manager', dueInDays: 3, required: true },
  { id: 't5', title: 'HR Policies Review', description: 'Review handbook and HR policies', category: 'hr', assigneeId: 'employee', dueInDays: 7, required: true },
  { id: 't6', title: 'First Week Feedback', description: 'Check in on first week experience', category: 'general', assigneeId: 'manager', dueInDays: 7, required: false },
];

// @route   GET /api/onboarding/stats/summary
// @desc    Get onboarding statistics
// @access  Private (Admin, HR)
router.get('/stats/summary', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const onboardings = await prisma.onboarding.findMany({
    include: { employee: { select: { name: true, department: true } } }
  });

  const statusObj = {};
  let avgProgressTotal = 0;
  let avgProgressCount = 0;
  let feedbackTotal = 0;
  let feedbackCount = 0;

  onboardings.forEach(o => {
    statusObj[o.status] = (statusObj[o.status] || 0) + 1;
    if (o.status !== 'completed') {
      avgProgressTotal += o.progress;
      avgProgressCount++;
    }
    if (o.feedback && typeof o.feedback === 'object' && o.feedback.rating) {
      feedbackTotal += o.feedback.rating;
      feedbackCount++;
    }
  });

  const statusCounts = Object.entries(statusObj).map(([id, count]) => ({ _id: id, count }));
  const recentOnboardings = onboardings
    .filter(o => o.status === 'in-progress' || o.status === 'in_progress')
    .sort((a, b) => b.startDate - a.startDate)
    .slice(0, 5);

  success(res, {
    statusCounts,
    avgProgress: avgProgressCount > 0 ? Math.round((avgProgressTotal / avgProgressCount) * 100) / 100 : 0,
    avgFeedbackRating: feedbackCount > 0 ? Math.round((feedbackTotal / feedbackCount) * 10) / 10 : 0,
    recentOnboardings,
  });
}));

// @route   GET /api/onboarding/templates/default
// @desc    Get default tasks template
// @access  Private (Admin, HR)
router.get('/templates/default', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  success(res, getDefaultTasks());
}));

// @route   GET /api/onboarding/my-onboarding
// @desc    Get current user's onboarding
// @access  Private
router.get('/my-onboarding', auth, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  if (!employee) throw new NotFoundError('Employee profile');

  const onboarding = await prisma.onboarding.findFirst({
    where: { employeeId: employee.id },
    include: { manager: { select: { name: true, email: true, department: true, position: true } } }
  });

  if (!onboarding) throw new NotFoundError('Onboarding record');

  const tasks = Array.isArray(onboarding.tasks) ? onboarding.tasks : [];
  
  const taskSummary = {
    total: tasks.length,
    completed: tasks.filter(t => t.completed || t.status === 'completed').length,
    pending: tasks.filter(t => !t.completed && t.status !== 'completed').length,
    overdue: tasks.filter(t => !t.completed && t.status !== 'completed' && new Date(t.dueDate) < new Date()).length,
  };

  success(res, { ...onboarding, taskSummary });
}));

// @route   GET /api/onboarding
// @desc    Get all onboarding records
// @access  Private (Admin, HR)
router.get('/', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const { status, department, page = 1, limit = 10 } = req.query;
  const where = {};

  if (status) where.status = status;

  if (department) {
    const emps = await prisma.employee.findMany({ where: { department }, select: { id: true } });
    where.employeeId = { in: emps.map(e => e.id) };
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, onboardings] = await Promise.all([
    prisma.onboarding.count({ where }),
    prisma.onboarding.findMany({
      where,
      include: {
        employee: { select: { name: true, employeeId: true, department: true, position: true } },
        manager: { select: { name: true, employeeId: true } }
      },
      orderBy: { startDate: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    })
  ]);

  paginated(res, onboardings, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/onboarding/:id
// @desc    Get single onboarding
// @access  Private
router.get('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const onboarding = await prisma.onboarding.findUnique({
    where: { id: req.params.id },
    include: {
      employee: { select: { userId: true, name: true, employeeId: true, department: true, position: true, email: true, phone: true } },
      manager: { select: { name: true, employeeId: true, email: true } }
    }
  });

  if (!onboarding) throw new NotFoundError('Onboarding');

  if (req.user.role === 'employee') {
    if (!onboarding.employee || onboarding.employee.userId !== req.user.id) {
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

  if (!employeeId || !startDate) throw new BadRequestError('Employee ID and start date are required');

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new NotFoundError('Employee');

  const existing = await prisma.onboarding.findFirst({ where: { employeeId } });
  if (existing) throw new ConflictError('Onboarding already exists for this employee');

  const manager = await prisma.employee.findUnique({ where: { id: mentorId || employeeId } });

  const tasksToCreate = customTasks || getDefaultTasks();
  const start = new Date(startDate);
  
  const tasks = tasksToCreate.map((task, index) => ({
    id: `task_${Date.now()}_${index}`,
    title: task.title,
    description: task.description || '',
    category: task.category || 'general',
    assigneeId: task.assigneeTo || task.assigneeId || 'employee',
    dueDate: new Date(start.getTime() + (task.dueInDays || 7) * 24 * 60 * 60 * 1000).toISOString(),
    completed: false,
    status: 'pending',
    required: task.required !== false,
  }));

  const onboarding = await prisma.onboarding.create({
    data: {
      employeeId,
      managerId: manager.id,
      startDate: start,
      status: 'in-progress',
      tasks,
      feedback: {},
    },
    include: {
      employee: { select: { name: true, employeeId: true, department: true } },
      manager: { select: { name: true } }
    }
  });

  created(res, onboarding, 'Onboarding created successfully');
}));

// @route   PUT /api/onboarding/:id
// @desc    Update onboarding details
// @access  Private (Admin, HR)
router.put('/:id', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const onboarding = await prisma.onboarding.findUnique({ where: { id: req.params.id } });

  if (!onboarding) throw new NotFoundError('Onboarding');

  const data = {};
  if (req.body.mentor !== undefined || req.body.mentorId !== undefined) data.managerId = req.body.mentor || req.body.mentorId;
  if (req.body.status !== undefined) data.status = req.body.status;
  // notes doesn't exist in Prisma schema directly, maybe store in tasks or discard. Prisma schema has `tasks` and `feedback`. We'll skip `notes`.

  const updatedOnboarding = await prisma.onboarding.update({
    where: { id: req.params.id },
    data,
    include: { employee: { select: { name: true, employeeId: true } } }
  });

  success(res, updatedOnboarding, 'Onboarding updated successfully');
}));

// @route   PUT /api/onboarding/:id/tasks/:taskId
// @desc    Update task status
// @access  Private
router.put('/:id/tasks/:taskId', auth, catchAsync(async (req, res) => {
  const onboarding = await prisma.onboarding.findUnique({ 
    where: { id: req.params.id },
    include: { employee: { select: { userId: true } } }
  });

  if (!onboarding) throw new NotFoundError('Onboarding');

  const tasks = Array.isArray(onboarding.tasks) ? [...onboarding.tasks] : [];
  const taskIndex = tasks.findIndex(t => t.id === req.params.taskId || t._id === req.params.taskId);
  
  if (taskIndex === -1) throw new NotFoundError('Task');

  if (req.user.role === 'employee') {
    if (onboarding.employee.userId !== req.user.id) {
      throw new ForbiddenError('You can only update your own onboarding tasks');
    }
  }

  const task = tasks[taskIndex];

  if (req.body.completed !== undefined) {
    task.completed = req.body.completed;
    task.status = req.body.completed ? 'completed' : 'pending';
    if (task.completed) {
      task.completedAt = new Date().toISOString();
      task.completedBy = req.user.id;
    } else {
      delete task.completedAt;
      delete task.completedBy;
    }
  }

  if (req.body.notes !== undefined) task.notes = req.body.notes;

  tasks[taskIndex] = task;

  const completedCount = tasks.filter(t => t.completed || t.status === 'completed').length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  
  let newStatus = onboarding.status;
  if (progress === 100 && (newStatus === 'in-progress' || newStatus === 'in_progress')) {
    newStatus = 'completed';
  }

  const updatedOnboarding = await prisma.onboarding.update({
    where: { id: req.params.id },
    data: { tasks, progress, status: newStatus }
  });

  success(res, updatedOnboarding, 'Task updated successfully');
}));

// @route   POST /api/onboarding/:id/tasks
// @desc    Add task to onboarding
// @access  Private (Admin, HR)
router.post('/:id/tasks', auth, authorize('admin', 'hr'), idValidation, onboardingTaskValidation, catchAsync(async (req, res) => {
  const onboarding = await prisma.onboarding.findUnique({ where: { id: req.params.id } });

  if (!onboarding) throw new NotFoundError('Onboarding');

  const { title, description, category, assignedTo, dueDate, required } = req.body;
  if (!title) throw new BadRequestError('Task title is required');

  const tasks = Array.isArray(onboarding.tasks) ? [...onboarding.tasks] : [];
  tasks.push({
    id: `task_${Date.now()}`,
    title,
    description: description || '',
    category: category || 'general',
    assigneeId: assignedTo || 'employee',
    dueDate: dueDate ? new Date(dueDate).toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    completed: false,
    status: 'pending',
    required: required !== false,
  });

  const completedCount = tasks.filter(t => t.completed || t.status === 'completed').length;
  const progress = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;

  const updatedOnboarding = await prisma.onboarding.update({
    where: { id: req.params.id },
    data: { tasks, progress }
  });

  created(res, updatedOnboarding, 'Task added successfully');
}));

// @route   DELETE /api/onboarding/:id/tasks/:taskId
// @desc    Remove task from onboarding
// @access  Private (Admin, HR)
router.delete('/:id/tasks/:taskId', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const onboarding = await prisma.onboarding.findUnique({ where: { id: req.params.id } });

  if (!onboarding) throw new NotFoundError('Onboarding');

  const tasks = Array.isArray(onboarding.tasks) ? [...onboarding.tasks] : [];
  const filteredTasks = tasks.filter(t => t.id !== req.params.taskId && t._id !== req.params.taskId);

  if (tasks.length === filteredTasks.length) throw new NotFoundError('Task');

  const completedCount = filteredTasks.filter(t => t.completed || t.status === 'completed').length;
  const progress = filteredTasks.length > 0 ? Math.round((completedCount / filteredTasks.length) * 100) : 0;

  const updatedOnboarding = await prisma.onboarding.update({
    where: { id: req.params.id },
    data: { tasks: filteredTasks, progress }
  });

  success(res, updatedOnboarding, 'Task removed successfully');
}));

// @route   POST /api/onboarding/:id/feedback
// @desc    Submit onboarding feedback
// @access  Private
router.post('/:id/feedback', auth, idValidation, catchAsync(async (req, res) => {
  const onboarding = await prisma.onboarding.findUnique({ 
    where: { id: req.params.id },
    include: { employee: { select: { userId: true } } }
  });

  if (!onboarding) throw new NotFoundError('Onboarding');

  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  
  if (employee && onboarding.employeeId !== employee.id) {
    if (!['hr', 'admin'].includes(req.user.role)) {
      throw new ForbiddenError('You can only submit feedback for your own onboarding');
    }
  }

  const { rating, comments } = req.body;
  if (!rating || rating < 1 || rating > 5) throw new BadRequestError('Rating must be between 1 and 5');

  const feedback = {
    rating,
    comments: comments || '',
    submittedAt: new Date().toISOString(),
    submittedById: employee ? employee.id : req.user.id,
  };

  const updatedOnboarding = await prisma.onboarding.update({
    where: { id: req.params.id },
    data: { feedback }
  });

  success(res, updatedOnboarding, 'Feedback submitted successfully');
}));

// @route   DELETE /api/onboarding/:id
// @desc    Delete onboarding record
// @access  Private (Admin)
router.delete('/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  await prisma.onboarding.delete({ where: { id: req.params.id } }).catch(() => {
    throw new NotFoundError('Onboarding');
  });
  success(res, null, 'Onboarding record deleted');
}));

module.exports = router;
