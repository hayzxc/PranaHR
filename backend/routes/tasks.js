/**
 * Tasks Routes
 * Daily task management for employees
 */

const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Employee = require('../models/Employee');
const { auth, authorize } = require('../middleware/auth');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created } = require('../utils/response');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { createNotification, createBulkNotifications } = require('../utils/notifications');

// @route   GET /api/tasks
// @desc    Get all tasks (Admin/HR see all, Employee sees own)
// @access  Private
router.get('/', auth, catchAsync(async (req, res) => {
    const { status, priority, assignedTo, page = 1, limit = 20 } = req.query;
    const query = {};

    // Employees can only see their own tasks
    if (req.user.role === 'employee') {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) {
            return success(res, { tasks: [], pagination: { total: 0, page: 1, pages: 0 } });
        }
        query.assignedTo = employee._id;
    } else if (assignedTo) {
        query.assignedTo = assignedTo;
    }

    if (status) query.status = status;
    if (priority) query.priority = priority;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [tasks, total] = await Promise.all([
        Task.find(query)
            .sort({ dueDate: 1, priority: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .populate('assignedTo', 'name email department position')
            .populate('assignedBy', 'email'),
        Task.countDocuments(query),
    ]);

    success(res, {
        tasks,
        pagination: {
            total,
            page: parseInt(page),
            pages: Math.ceil(total / parseInt(limit)),
            hasMore: skip + tasks.length < total,
        },
    });
}));

// @route   GET /api/tasks/my
// @desc    Get current user's tasks
// @access  Private
router.get('/my', auth, catchAsync(async (req, res) => {
    const employee = await Employee.findOne({ userId: req.user._id });

    if (!employee) {
        return success(res, { tasks: [], stats: { pending: 0, in_progress: 0, completed: 0, overdue: 0 } });
    }

    const now = new Date();
    const todayStart = new Date(now.setHours(0, 0, 0, 0));
    const todayEnd = new Date(now.setHours(23, 59, 59, 999));

    const [tasks, stats] = await Promise.all([
        Task.find({ assignedTo: employee._id })
            .sort({ dueDate: 1, priority: -1 })
            .populate('assignedBy', 'email'),
        Task.aggregate([
            { $match: { assignedTo: employee._id } },
            {
                $group: {
                    _id: null,
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                    in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                    overdue: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $lt: ['$dueDate', new Date()] },
                                        { $not: { $in: ['$status', ['completed', 'cancelled']] } }
                                    ]
                                },
                                1, 0
                            ]
                        }
                    },
                },
            },
        ]),
    ]);

    success(res, {
        tasks,
        stats: stats[0] || { pending: 0, in_progress: 0, completed: 0, overdue: 0 },
    });
}));

// @route   GET /api/tasks/:id
// @desc    Get single task
// @access  Private
router.get('/:id', auth, catchAsync(async (req, res) => {
    const task = await Task.findById(req.params.id)
        .populate('assignedTo', 'name email department position')
        .populate('assignedBy', 'email');

    if (!task) {
        throw new NotFoundError('Task');
    }

    // Check access for employees
    if (req.user.role === 'employee') {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee || task.assignedTo._id.toString() !== employee._id.toString()) {
            throw new ForbiddenError('You can only view your own tasks');
        }
    }

    success(res, task);
}));

// @route   POST /api/tasks
// @desc    Create new task
// @access  Private (Admin/HR)
router.post('/', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
    const { title, description, assignedTo, dueDate, priority, category } = req.body;

    if (!title || !assignedTo || !dueDate) {
        throw new BadRequestError('Title, assignedTo, and dueDate are required');
    }

    // Verify employee exists
    const employee = await Employee.findById(assignedTo);
    if (!employee) {
        throw new NotFoundError('Employee');
    }

    const task = await Task.create({
        title,
        description,
        assignedTo,
        assignedBy: req.user._id,
        dueDate: new Date(dueDate),
        priority: priority || 'medium',
        category,
    });

    await task.populate('assignedTo', 'name email department position');
    await task.populate('assignedBy', 'email');

    // Notify the assigned employee
    if (employee.userId) {
        const dueDateStr = new Date(dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        createNotification({
            recipient: employee.userId,
            type: 'task_assigned',
            title: 'New Task Assigned 📋',
            message: `You have a new task: "${title}". Due: ${dueDateStr}`,
            link: '/tasks',
            relatedId: task._id,
        });
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

    // Verify all employees exist
    const employees = await Employee.find({ _id: { $in: employeeIds } });
    if (employees.length !== employeeIds.length) {
        throw new BadRequestError('Some employees not found');
    }

    const tasks = await Task.insertMany(
        employeeIds.map(empId => ({
            title,
            description,
            assignedTo: empId,
            assignedBy: req.user._id,
            dueDate: new Date(dueDate),
            priority: priority || 'medium',
            category,
        }))
    );

    // Notify each assigned employee
    const dueDateStr = new Date(dueDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const recipientUserIds = employees.filter(e => e.userId).map(e => e.userId);
    if (recipientUserIds.length > 0) {
        createBulkNotifications(recipientUserIds, {
            type: 'task_assigned',
            title: 'New Task Assigned 📋',
            message: `You have a new task: "${title}". Due: ${dueDateStr}`,
            link: '/tasks',
        });
    }

    created(res, { count: tasks.length, tasks }, `${tasks.length} tasks created successfully`);
}));

// @route   PUT /api/tasks/:id
// @desc    Update task
// @access  Private (Admin/HR)
router.put('/:id', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
    const { title, description, assignedTo, dueDate, priority, category, status } = req.body;

    const task = await Task.findById(req.params.id);
    if (!task) {
        throw new NotFoundError('Task');
    }

    // Update fields
    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (assignedTo) task.assignedTo = assignedTo;
    if (dueDate) task.dueDate = new Date(dueDate);
    if (priority) task.priority = priority;
    if (category !== undefined) task.category = category;
    if (status) task.status = status;

    await task.save();
    await task.populate('assignedTo', 'name email department position');
    await task.populate('assignedBy', 'email');

    success(res, task, 'Task updated successfully');
}));

// @route   PUT /api/tasks/:id/status
// @desc    Update task status (employees can update own)
// @access  Private
router.put('/:id/status', auth, catchAsync(async (req, res) => {
    const { status, notes } = req.body;

    if (!status || !['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
        throw new BadRequestError('Valid status is required');
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
        throw new NotFoundError('Task');
    }

    // Check access for employees
    if (req.user.role === 'employee') {
        const employee = await Employee.findOne({ userId: req.user._id });
        if (!employee || task.assignedTo.toString() !== employee._id.toString()) {
            throw new ForbiddenError('You can only update your own tasks');
        }
        // Employees cannot cancel tasks
        if (status === 'cancelled') {
            throw new ForbiddenError('Only admin/HR can cancel tasks');
        }
    }

    task.status = status;
    if (notes) task.notes = notes;

    await task.save();
    await task.populate('assignedTo', 'name email department position');

    success(res, task, 'Task status updated successfully');
}));

// @route   DELETE /api/tasks/:id
// @desc    Delete task
// @access  Private (Admin/HR)
router.delete('/:id', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
    const task = await Task.findById(req.params.id);
    if (!task) {
        throw new NotFoundError('Task');
    }

    await task.deleteOne();
    success(res, null, 'Task deleted successfully');
}));

// @route   GET /api/tasks/stats/overview
// @desc    Get task statistics
// @access  Private (Admin/HR)
router.get('/stats/overview', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
    const now = new Date();

    const stats = await Task.aggregate([
        {
            $group: {
                _id: null,
                total: { $sum: 1 },
                pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                in_progress: { $sum: { $cond: [{ $eq: ['$status', 'in_progress'] }, 1, 0] } },
                completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                overdue: {
                    $sum: {
                        $cond: [
                            {
                                $and: [
                                    { $lt: ['$dueDate', now] },
                                    { $not: { $in: ['$status', ['completed', 'cancelled']] } }
                                ]
                            },
                            1, 0
                        ]
                    }
                },
            },
        },
    ]);

    success(res, stats[0] || { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 });
}));

module.exports = router;
