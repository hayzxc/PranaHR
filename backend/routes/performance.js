/**
 * Performance Routes
 * Type-safe performance reviews and goal management
 */

const express = require('express');
const router = express.Router();
const PerformanceReview = require('../models/PerformanceReview');
const Goal = require('../models/Goal');
const Employee = require('../models/Employee');
const { auth, authorize } = require('../middleware/auth');
const { idValidation, performanceValidation } = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created, paginated } = require('../utils/response');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');

// ==================== PERFORMANCE REVIEWS ====================

// @route   GET /api/performance/stats
// @desc    Get performance statistics
// @access  Private (Admin, HR)
router.get('/stats', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();

  const [reviewStats, goalStats, ratingDistribution, departmentAvg] = await Promise.all([
    PerformanceReview.aggregate([
      { $match: { year } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgRating: { $avg: '$overallRating' },
        },
      },
    ]),
    Goal.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
    PerformanceReview.aggregate([
      { $match: { year, overallRating: { $exists: true, $ne: null } } },
      {
        $bucket: {
          groupBy: '$overallRating',
          boundaries: [1, 2, 3, 4, 5, 6],
          default: 'Other',
          output: { count: { $sum: 1 } },
        },
      },
    ]),
    PerformanceReview.aggregate([
      { $match: { year, status: 'acknowledged' } },
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
          avgRating: { $avg: '$overallRating' },
          count: { $sum: 1 },
        },
      },
      { $sort: { avgRating: -1 } },
    ]),
  ]);

  success(res, {
    year,
    reviews: reviewStats,
    goals: goalStats,
    ratingDistribution,
    departmentAvg,
  });
}));

// @route   GET /api/performance/reviews
// @desc    Get all reviews
// @access  Private
router.get('/reviews', auth, catchAsync(async (req, res) => {
  const { year, period, status, department, page = 1, limit = 10 } = req.query;
  const query = {};

  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee) {throw new NotFoundError('Employee profile');}
    query.employee = employee._id;
  }

  if (year) {query.year = parseInt(year);}
  if (period) {query.reviewPeriod = period;}
  if (status) {query.status = status;}

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  let reviews = await PerformanceReview.find(query)
    .populate('employee', 'name employeeId department position')
    .populate('reviewer', 'name employeeId')
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .lean();

  // Filter by department if specified (HR/Admin only)
  if (department && req.user.role !== 'employee') {
    reviews = reviews.filter(r => r.employee?.department === department);
  }

  const total = await PerformanceReview.countDocuments(query);

  paginated(res, reviews, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/performance/reviews/:id
// @desc    Get single review
// @access  Private
router.get('/reviews/:id', auth, idValidation, catchAsync(async (req, res) => {
  const review = await PerformanceReview.findById(req.params.id)
    .populate('employee', 'name employeeId department position email')
    .populate('reviewer', 'name employeeId')
    .lean();

  if (!review) {
    throw new NotFoundError('Performance review');
  }

  // Check access for employees
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee || review.employee._id.toString() !== employee._id.toString()) {
      throw new ForbiddenError('You can only view your own reviews');
    }
  }

  success(res, review);
}));

// @route   POST /api/performance/reviews
// @desc    Create review
// @access  Private (Admin, HR)
router.post('/reviews', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const { employeeId, reviewPeriod, year, ratings, strengths, areasForImprovement, goals } = req.body;

  if (!employeeId || !reviewPeriod) {
    throw new BadRequestError('Employee ID and review period are required');
  }

  const employee = await Employee.findById(employeeId);
  if (!employee) {
    throw new NotFoundError('Employee');
  }

  const reviewer = await Employee.findOne({ userId: req.user._id });

  const review = new PerformanceReview({
    employee: employeeId,
    reviewer: reviewer?._id || employeeId,
    reviewPeriod,
    year: year || new Date().getFullYear(),
    ratings,
    strengths,
    areasForImprovement,
    goals,
  });

  await review.save();

  const populatedReview = await PerformanceReview.findById(review._id)
    .populate('employee', 'name employeeId department')
    .lean();

  created(res, populatedReview, 'Performance review created successfully');
}));

// @route   PUT /api/performance/reviews/:id
// @desc    Update review
// @access  Private (Admin, HR)
router.put('/reviews/:id', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const review = await PerformanceReview.findById(req.params.id);

  if (!review) {
    throw new NotFoundError('Performance review');
  }

  const allowedUpdates = ['ratings', 'strengths', 'areasForImprovement', 'goals', 'status', 'overallRating', 'recommendations'];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      review[field] = req.body[field];
    }
  });

  if (req.body.status === 'submitted' && !review.submittedAt) {
    review.submittedAt = new Date();
  }

  await review.save();

  const populatedReview = await PerformanceReview.findById(review._id)
    .populate('employee', 'name employeeId department')
    .lean();

  success(res, populatedReview, 'Performance review updated successfully');
}));

// @route   PUT /api/performance/reviews/:id/acknowledge
// @desc    Employee acknowledges review
// @access  Private
router.put('/reviews/:id/acknowledge', auth, idValidation, catchAsync(async (req, res) => {
  const review = await PerformanceReview.findById(req.params.id);

  if (!review) {
    throw new NotFoundError('Performance review');
  }

  const employee = await Employee.findOne({ userId: req.user._id });
  if (!employee || review.employee.toString() !== employee._id.toString()) {
    throw new ForbiddenError('You can only acknowledge your own reviews');
  }

  if (review.status !== 'submitted') {
    throw new BadRequestError('Review must be submitted before acknowledging');
  }

  review.status = 'acknowledged';
  review.acknowledgedAt = new Date();
  review.employeeFeedback = req.body.feedback || '';
  await review.save();

  success(res, review, 'Review acknowledged successfully');
}));

// @route   DELETE /api/performance/reviews/:id
// @desc    Delete review
// @access  Private (Admin)
router.delete('/reviews/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const review = await PerformanceReview.findById(req.params.id);

  if (!review) {
    throw new NotFoundError('Performance review');
  }

  await PerformanceReview.findByIdAndDelete(req.params.id);

  success(res, null, 'Performance review deleted successfully');
}));

// ==================== GOALS ====================

// @route   GET /api/performance/goals
// @desc    Get goals
// @access  Private
router.get('/goals', auth, catchAsync(async (req, res) => {
  const { status, category, priority, page = 1, limit = 10 } = req.query;
  const query = {};

  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee) {throw new NotFoundError('Employee profile');}
    query.employee = employee._id;
  } else if (req.query.employeeId) {
    query.employee = req.query.employeeId;
  }

  if (status) {query.status = status;}
  if (category) {query.category = category;}
  if (priority) {query.priority = priority;}

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, goals] = await Promise.all([
    Goal.countDocuments(query),
    Goal.find(query)
      .populate('employee', 'name employeeId department')
      .populate('assignedBy', 'name employeeId')
      .sort({ dueDate: 1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
  ]);

  paginated(res, goals, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/performance/goals/:id
// @desc    Get single goal
// @access  Private
router.get('/goals/:id', auth, idValidation, catchAsync(async (req, res) => {
  const goal = await Goal.findById(req.params.id)
    .populate('employee', 'name employeeId department')
    .populate('assignedBy', 'name')
    .populate('comments.author', 'name')
    .lean();

  if (!goal) {
    throw new NotFoundError('Goal');
  }

  success(res, goal);
}));

// @route   POST /api/performance/goals
// @desc    Create goal
// @access  Private
router.post('/goals', auth, catchAsync(async (req, res) => {
  const { title, description, category, priority, dueDate, keyResults, employeeId } = req.body;

  if (!title) {
    throw new BadRequestError('Goal title is required');
  }

  let targetEmployee;
  if (req.user.role === 'employee') {
    targetEmployee = await Employee.findOne({ userId: req.user._id });
  } else if (employeeId) {
    targetEmployee = await Employee.findById(employeeId);
  } else {
    targetEmployee = await Employee.findOne({ userId: req.user._id });
  }

  if (!targetEmployee) {
    throw new NotFoundError('Employee');
  }

  const assignedBy = await Employee.findOne({ userId: req.user._id });

  const goal = new Goal({
    employee: targetEmployee._id,
    title,
    description,
    category: category || 'professional',
    priority: priority || 'medium',
    dueDate,
    keyResults,
    assignedBy: assignedBy?._id,
  });

  await goal.save();

  const populatedGoal = await Goal.findById(goal._id)
    .populate('employee', 'name employeeId')
    .lean();

  created(res, populatedGoal, 'Goal created successfully');
}));

// @route   PUT /api/performance/goals/:id
// @desc    Update goal
// @access  Private
router.put('/goals/:id', auth, idValidation, catchAsync(async (req, res) => {
  const goal = await Goal.findById(req.params.id);

  if (!goal) {
    throw new NotFoundError('Goal');
  }

  // Check access for employees
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee || goal.employee.toString() !== employee._id.toString()) {
      throw new ForbiddenError('You can only update your own goals');
    }
  }

  const allowedUpdates = ['title', 'description', 'category', 'priority', 'dueDate', 'progress', 'status', 'keyResults', 'milestones'];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      goal[field] = req.body[field];
    }
  });

  // Auto-complete if progress is 100%
  if (goal.progress === 100 && goal.status !== 'completed') {
    goal.status = 'completed';
    goal.completedAt = new Date();
  }

  await goal.save();

  const populatedGoal = await Goal.findById(goal._id)
    .populate('employee', 'name employeeId')
    .lean();

  success(res, populatedGoal, 'Goal updated successfully');
}));

// @route   POST /api/performance/goals/:id/comments
// @desc    Add comment to goal
// @access  Private
router.post('/goals/:id/comments', auth, idValidation, catchAsync(async (req, res) => {
  const goal = await Goal.findById(req.params.id);

  if (!goal) {
    throw new NotFoundError('Goal');
  }

  if (!req.body.text) {
    throw new BadRequestError('Comment text is required');
  }

  const author = await Employee.findOne({ userId: req.user._id });

  goal.comments.push({
    author: author?._id,
    text: req.body.text,
    createdAt: new Date(),
  });

  await goal.save();

  const populatedGoal = await Goal.findById(goal._id)
    .populate('comments.author', 'name')
    .lean();

  success(res, populatedGoal, 'Comment added successfully');
}));

// @route   DELETE /api/performance/goals/:id
// @desc    Delete goal
// @access  Private
router.delete('/goals/:id', auth, idValidation, catchAsync(async (req, res) => {
  const goal = await Goal.findById(req.params.id);

  if (!goal) {
    throw new NotFoundError('Goal');
  }

  // Check access for employees
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee || goal.employee.toString() !== employee._id.toString()) {
      throw new ForbiddenError('You can only delete your own goals');
    }
  }

  await Goal.findByIdAndDelete(req.params.id);

  success(res, null, 'Goal deleted successfully');
}));

// @route   GET /api/performance/my-summary
// @desc    Get current user's performance summary
// @access  Private
router.get('/my-summary', auth, catchAsync(async (req, res) => {
  const employee = await Employee.findOne({ userId: req.user._id });

  if (!employee) {
    throw new NotFoundError('Employee profile');
  }

  const currentYear = new Date().getFullYear();

  const [reviews, goals, recentReview] = await Promise.all([
    PerformanceReview.find({
      employee: employee._id,
      year: currentYear,
    }).select('reviewPeriod status overallRating').lean(),
    Goal.find({ employee: employee._id }).lean(),
    PerformanceReview.findOne({
      employee: employee._id,
    }).sort({ createdAt: -1 }).lean(),
  ]);

  const goalSummary = {
    total: goals.length,
    completed: goals.filter(g => g.status === 'completed').length,
    inProgress: goals.filter(g => g.status === 'in_progress').length,
    notStarted: goals.filter(g => g.status === 'not_started').length,
    avgProgress: goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)
      : 0,
  };

  const avgRating = reviews.length > 0
    ? Math.round((reviews.reduce((sum, r) => sum + (r.overallRating || 0), 0) / reviews.filter(r => r.overallRating).length) * 10) / 10
    : null;

  success(res, {
    employee: { id: employee._id, name: employee.name },
    year: currentYear,
    reviews: {
      total: reviews.length,
      avgRating,
    },
    goals: goalSummary,
    recentReview: recentReview ? {
      period: recentReview.reviewPeriod,
      rating: recentReview.overallRating,
      status: recentReview.status,
    } : null,
  });
}));

module.exports = router;
