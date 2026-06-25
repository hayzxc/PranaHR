/**
 * Tasks Routes
 * Daily task management for employees
 * PONYTAIL FIX: Prisma ORM Integration
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../lib/prisma').default;
const { auth, authorize } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created, paginated } = require('../utils/response');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { createNotification, createBulkNotifications } = require('../utils/notifications');

// Configure multer storage for tasks
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/tasks');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const cleanupFile = (filepath) => {
  try {
    if (filepath && fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  } catch (err) {
    console.error('Error cleaning up file:', err);
  }
};

// @route   GET /api/tasks
// @desc    Get all tasks (Admin/HR see all, Employee sees own)
// @access  Private
router.get('/', auth, catchAsync(async (req, res) => {
  const { status, priority, assignedTo, page = 1, limit = 20 } = req.query;
  const where = {};

  if (req.user.role === 'employee') {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) return success(res, { tasks: [], pagination: { total: 0, page: 1, pages: 0 } });
    where.assignedToId = employee.id;
  } else if (assignedTo) {
    where.assignedToId = assignedTo;
  }

  if (status) where.status = status;
  if (priority) where.priority = priority;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, tasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      include: {
        assignedTo: { select: { name: true, email: true, department: true, position: true } },
        assignedBy: { select: { email: true } }
      },
      orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    })
  ]);

  success(res, {
    tasks,
    pagination: {
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
      hasMore: (pageNum - 1) * limitNum + tasks.length < total,
    },
  });
}));

// @route   GET /api/tasks/my
// @desc    Get current user's tasks
// @access  Private
router.get('/my', auth, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });

  if (!employee) {
    return success(res, { tasks: [], stats: { pending: 0, in_progress: 0, completed: 0, overdue: 0 } });
  }

  const now = new Date();

  const tasks = await prisma.task.findMany({
    where: { assignedToId: employee.id },
    include: { assignedBy: { select: { email: true } } },
    orderBy: [{ dueDate: 'asc' }, { priority: 'desc' }]
  });

  const stats = { pending: 0, in_progress: 0, completed: 0, overdue: 0 };
  
  tasks.forEach(t => {
    if (t.status === 'pending') stats.pending++;
    if (t.status === 'in_progress' || t.status === 'in-progress') stats.in_progress++;
    if (t.status === 'completed') stats.completed++;

    if (t.dueDate < now && t.status !== 'completed' && t.status !== 'cancelled') {
      stats.overdue++;
    }
  });

  success(res, { tasks, stats });
}));

// @route   GET /api/tasks/:id
// @desc    Get single task
// @access  Private
router.get('/:id', auth, catchAsync(async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      assignedTo: { select: { userId: true, name: true, email: true, department: true, position: true } },
      assignedBy: { select: { email: true } }
    }
  });

  if (!task) throw new NotFoundError('Task');

  if (req.user.role === 'employee') {
    if (!task.assignedTo || task.assignedTo.userId !== req.user.id) {
      throw new ForbiddenError('You can only view your own tasks');
    }
  }

  success(res, task);
}));

// @route   POST /api/tasks
// @desc    Create new task
// @access  Private (Admin/HR)
router.post('/', auth, authorize('admin', 'hr'), upload.single('file'), catchAsync(async (req, res) => {
  const { title, description, assignedTo, dueDate, priority, category } = req.body;

  if (!title || !assignedTo || !dueDate) {
    if (req.file) cleanupFile(req.file.path);
    throw new BadRequestError('Title, assignedTo, and dueDate are required');
  }

  const employee = await prisma.employee.findUnique({ where: { id: assignedTo } });
  if (!employee) {
    if (req.file) cleanupFile(req.file.path);
    throw new NotFoundError('Employee');
  }

  const taskData = {
    title,
    description,
    assignedToId: assignedTo,
    assignedById: req.user.id,
    dueDate: new Date(dueDate),
    priority: priority || 'medium',
    category: category || '',
  };

  if (req.file) {
    taskData.attachmentUrl = `uploads/tasks/${req.file.filename}`;
    taskData.attachmentName = req.file.originalname;
  }

  const task = await prisma.task.create({
    data: taskData,
    include: {
      assignedTo: { select: { name: true, email: true, department: true, position: true } },
      assignedBy: { select: { email: true } }
    }
  });

  if (employee.userId) {
    const dueDateStr = new Date(dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    // Stub for createNotification...
  }

  created(res, task, 'Task created successfully');
}));

// @route   POST /api/tasks/bulk
// @desc    Create tasks for multiple employees
// @access  Private (Admin/HR)
router.post('/bulk', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const { title, description, employeeIds, dueDate, priority, category } = req.body;

  if (!title || !employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0 || !dueDate) {
    throw new BadRequestError('Title, employeeIds array, and dueDate are required');
  }

  const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } } });
  if (employees.length !== employeeIds.length) {
    throw new BadRequestError('Some employees not found');
  }

  const tasksData = employeeIds.map(empId => ({
    title,
    description: description || null,
    assignedToId: empId,
    assignedById: req.user.id,
    dueDate: new Date(dueDate),
    priority: priority || 'medium',
    category: category || '',
  }));

  const createdCount = await prisma.task.createMany({ data: tasksData });

  const recipientUserIds = employees.filter(e => e.userId).map(e => e.userId);
  if (recipientUserIds.length > 0) {
    const dueDateStr = new Date(dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    // Stub for createBulkNotifications...
  }

  created(res, { count: createdCount.count }, `${createdCount.count} tasks created successfully`);
}));

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private (Admin/HR)
router.put('/:id', auth, authorize('admin', 'hr'), upload.single('file'), catchAsync(async (req, res) => {
  const { title, description, assignedTo, dueDate, priority, category, status } = req.body;

  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) {
    if (req.file) cleanupFile(req.file.path);
    throw new NotFoundError('Task');
  }

  const data = {};
  if (title) data.title = title;
  if (description !== undefined) data.description = description;
  if (assignedTo) data.assignedToId = assignedTo;
  if (dueDate) data.dueDate = new Date(dueDate);
  if (priority) data.priority = priority;
  if (category !== undefined) data.category = category;
  if (status) {
    data.status = status;
    if (status === 'completed') data.completedAt = new Date();
  }

  if (req.file) {
    data.attachmentUrl = `uploads/tasks/${req.file.filename}`;
    data.attachmentName = req.file.originalname;
    
    // Clean up old file
    if (task.attachmentUrl) {
      cleanupFile(path.join(__dirname, '..', task.attachmentUrl));
    }
  }

  const updatedTask = await prisma.task.update({
    where: { id: req.params.id },
    data,
    include: {
      assignedTo: { select: { name: true, email: true, department: true, position: true } },
      assignedBy: { select: { email: true } }
    }
  });

  success(res, updatedTask, 'Task updated successfully');
}));

// @route   PUT /api/tasks/:id/status
// @desc    Update task status (employees can update own)
// @access  Private
router.put('/:id/status', auth, catchAsync(async (req, res) => {
  const { status, notes } = req.body;

  if (!status || !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
    throw new BadRequestError('Valid status is required');
  }

  const task = await prisma.task.findUnique({ 
    where: { id: req.params.id },
    include: { assignedTo: { select: { userId: true } } }
  });

  if (!task) throw new NotFoundError('Task');

  if (req.user.role === 'employee') {
    if (!task.assignedTo || task.assignedTo.userId !== req.user.id) {
      throw new ForbiddenError('You can only update your own tasks');
    }
    if (status === 'cancelled') {
      throw new ForbiddenError('Only admin/HR can cancel tasks');
    }
  }

  const data = { status };
  if (notes) data.notes = notes;
  if (status === 'completed') data.completedAt = new Date();

  const updatedTask = await prisma.task.update({
    where: { id: req.params.id },
    data,
    include: { assignedTo: { select: { name: true, email: true, department: true, position: true } } }
  });

  success(res, updatedTask, 'Task status updated successfully');
}));

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private (Admin/HR)
router.delete('/:id', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const task = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!task) throw new NotFoundError('Task');

  // Clean up attached file if exists
  if (task.attachmentUrl) {
    cleanupFile(path.join(__dirname, '..', task.attachmentUrl));
  }

  await prisma.task.delete({ where: { id: req.params.id } });
  success(res, null, 'Task deleted successfully');
}));

// @route   GET /api/tasks/stats/overview
// @desc    Get task statistics
// @access  Private (Admin/HR)
router.get('/stats/overview', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const now = new Date();

  const tasks = await prisma.task.findMany();

  const stats = { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 };
  
  tasks.forEach(t => {
    stats.total++;
    if (t.status === 'pending') stats.pending++;
    if (t.status === 'in_progress' || t.status === 'in-progress') stats.in_progress++;
    if (t.status === 'completed') stats.completed++;

    if (t.dueDate < now && t.status !== 'completed' && t.status !== 'cancelled') {
      stats.overdue++;
    }
  });

  success(res, stats);
}));

module.exports = router;
