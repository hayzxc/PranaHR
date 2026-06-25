/**
 * Performance Routes
 * Type-safe performance reviews and goal management
 * PONYTAIL FIX: Prisma ORM Integration & Strict Ratings Destructuring
 */

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma').default;
const { auth, authorize } = require('../middleware/auth');
const { idValidation, performanceValidation } = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created, paginated } = require('../utils/response');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');

// ==================== PERFORMANCE REVIEWS ====================

// Helper to map Prisma flat fields to nested ratings object for frontend compatibility
const mapReviewToFrontend = (review) => {
  if (!review) return null;
  const {
    productivityScore, productivityComment,
    qualityScore, qualityComment,
    teamworkScore, teamworkComment,
    communicationScore, communicationComment,
    initiativeScore, initiativeComment,
    attendanceScore, attendanceComment,
    ...rest
  } = review;

  return {
    ...rest,
    ratings: {
      productivity: { score: productivityScore, comment: productivityComment },
      quality: { score: qualityScore, comment: qualityComment },
      teamwork: { score: teamworkScore, comment: teamworkComment },
      communication: { score: communicationScore, comment: communicationComment },
      initiative: { score: initiativeScore, comment: initiativeComment },
      attendance: { score: attendanceScore, comment: attendanceComment },
    }
  };
};

// Helper to map frontend ratings object to Prisma flat fields
const mapRatingsToPrisma = (ratings = {}) => ({
  productivityScore: ratings.productivity?.score || null,
  productivityComment: ratings.productivity?.comment || null,
  qualityScore: ratings.quality?.score || null,
  qualityComment: ratings.quality?.comment || null,
  teamworkScore: ratings.teamwork?.score || null,
  teamworkComment: ratings.teamwork?.comment || null,
  communicationScore: ratings.communication?.score || null,
  communicationComment: ratings.communication?.comment || null,
  initiativeScore: ratings.initiative?.score || null,
  initiativeComment: ratings.initiative?.comment || null,
  attendanceScore: ratings.attendance?.score || null,
  attendanceComment: ratings.attendance?.comment || null,
});

// @route   GET /api/performance/stats
// @desc    Get performance statistics
// @access  Private (Admin, HR)
router.get('/stats', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();

  const reviews = await prisma.performanceReview.findMany({
    where: { year },
    include: { employee: true }
  });

  const goals = await prisma.goal.findMany();

  const statusGroups = {};
  let totalRating = 0;
  let ratedCount = 0;
  const ratingDistribution = [
    { _id: 1, count: 0 }, { _id: 2, count: 0 }, { _id: 3, count: 0 }, 
    { _id: 4, count: 0 }, { _id: 5, count: 0 }, { _id: 'Other', count: 0 }
  ];
  const deptGroups = {};

  reviews.forEach(r => {
    // Status
    statusGroups[r.status] = (statusGroups[r.status] || 0) + 1;

    // Ratings
    if (r.overallRating !== null) {
      totalRating += r.overallRating;
      ratedCount++;

      const rounded = Math.round(r.overallRating);
      if (rounded >= 1 && rounded <= 5) {
        ratingDistribution[rounded - 1].count++;
      } else {
        ratingDistribution[5].count++;
      }
    }

    // Department Avg
    if (r.status === 'acknowledged' && r.employee && r.overallRating !== null) {
      const dept = r.employee.department;
      if (!deptGroups[dept]) deptGroups[dept] = { total: 0, count: 0 };
      deptGroups[dept].total += r.overallRating;
      deptGroups[dept].count++;
    }
  });

  const reviewStats = Object.entries(statusGroups).map(([id, count]) => ({
    _id: id, count, avgRating: ratedCount > 0 ? totalRating / ratedCount : null
  }));

  const goalStatsObj = {};
  goals.forEach(g => {
    goalStatsObj[g.status] = (goalStatsObj[g.status] || 0) + 1;
  });
  const goalStats = Object.entries(goalStatsObj).map(([id, count]) => ({ _id: id, count }));

  const departmentAvg = Object.entries(deptGroups).map(([id, data]) => ({
    _id: id, count: data.count, avgRating: data.total / data.count
  })).sort((a, b) => b.avgRating - a.avgRating);

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
  const where = {};

  if (req.user.role === 'employee') {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) throw new NotFoundError('Employee profile');
    where.employeeId = employee.id;
  }

  if (year) where.year = parseInt(year);
  if (period) where.reviewPeriod = period;
  if (status) where.status = status;

  if (department && req.user.role !== 'employee') {
    const emps = await prisma.employee.findMany({ where: { department }, select: { id: true } });
    where.employeeId = { in: emps.map(e => e.id) };
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, reviews] = await Promise.all([
    prisma.performanceReview.count({ where }),
    prisma.performanceReview.findMany({
      where,
      include: {
        employee: { select: { name: true, employeeId: true, department: true, position: true } },
        reviewer: { select: { name: true, employeeId: true } }
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
  ]);

  paginated(res, reviews.map(mapReviewToFrontend), { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/performance/reviews/:id
// @desc    Get single review
// @access  Private
router.get('/reviews/:id', auth, idValidation, catchAsync(async (req, res) => {
  const review = await prisma.performanceReview.findUnique({
    where: { id: req.params.id },
    include: {
      employee: { select: { userId: true, name: true, employeeId: true, department: true, position: true, email: true } },
      reviewer: { select: { name: true, employeeId: true } }
    }
  });

  if (!review) throw new NotFoundError('Performance review');

  if (req.user.role === 'employee') {
    if (!review.employee || review.employee.userId !== req.user.id) {
      throw new ForbiddenError('You can only view your own reviews');
    }
  }

  success(res, mapReviewToFrontend(review));
}));

// @route   POST /api/performance/reviews
// @desc    Create review
// @access  Private (Admin, HR)
router.post('/reviews', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const { employeeId, reviewPeriod, year, ratings, strengths, areasForImprovement, goals, overallRating } = req.body;

  if (!employeeId || !reviewPeriod) throw new BadRequestError('Employee ID and review period are required');

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new NotFoundError('Employee');

  const reviewer = await prisma.employee.findUnique({ where: { userId: req.user.id } });

  const prismaRatings = mapRatingsToPrisma(ratings);

  const review = await prisma.performanceReview.create({
    data: {
      employeeId,
      reviewerId: reviewer?.id || employeeId,
      reviewPeriod,
      year: year || new Date().getFullYear(),
      overallRating: overallRating || null,
      strengths: strengths || "",
      areasForImprovement: areasForImprovement || "",
      goals: goals || "",
      ...prismaRatings,
    },
    include: { employee: { select: { name: true, employeeId: true, department: true } } }
  });

  created(res, mapReviewToFrontend(review), 'Performance review created successfully');
}));

// @route   PUT /api/performance/reviews/:id
// @desc    Update review
// @access  Private (Admin, HR)
router.put('/reviews/:id', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const review = await prisma.performanceReview.findUnique({ where: { id: req.params.id } });

  if (!review) throw new NotFoundError('Performance review');

  let data = {};
  
  if (req.body.ratings) {
    const prismaRatings = mapRatingsToPrisma(req.body.ratings);
    data = { ...data, ...prismaRatings };
  }

  const standardFields = ['strengths', 'areasForImprovement', 'goals', 'status', 'overallRating'];
  standardFields.forEach(f => {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  });

  if (req.body.status === 'submitted' && !review.submittedAt) {
    data.submittedAt = new Date();
  }

  const updatedReview = await prisma.performanceReview.update({
    where: { id: req.params.id },
    data,
    include: { employee: { select: { name: true, employeeId: true, department: true } } }
  });

  success(res, mapReviewToFrontend(updatedReview), 'Performance review updated successfully');
}));

// @route   PUT /api/performance/reviews/:id/acknowledge
// @desc    Employee acknowledges review
// @access  Private
router.put('/reviews/:id/acknowledge', auth, idValidation, catchAsync(async (req, res) => {
  const review = await prisma.performanceReview.findUnique({ 
    where: { id: req.params.id },
    include: { employee: true }
  });

  if (!review) throw new NotFoundError('Performance review');

  if (review.employee.userId !== req.user.id) {
    throw new ForbiddenError('You can only acknowledge your own reviews');
  }

  if (review.status !== 'submitted') {
    throw new BadRequestError('Review must be submitted before acknowledging');
  }

  const updatedReview = await prisma.performanceReview.update({
    where: { id: req.params.id },
    data: {
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      employeeFeedback: req.body.feedback || ''
    }
  });

  success(res, mapReviewToFrontend(updatedReview), 'Review acknowledged successfully');
}));

// @route   DELETE /api/performance/reviews/:id
// @desc    Delete review
// @access  Private (Admin)
router.delete('/reviews/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  await prisma.performanceReview.delete({ where: { id: req.params.id } }).catch(() => {
    throw new NotFoundError('Performance review');
  });

  success(res, null, 'Performance review deleted successfully');
}));

// ==================== GOALS ====================

// @route   GET /api/performance/goals
// @desc    Get goals
// @access  Private
router.get('/goals', auth, catchAsync(async (req, res) => {
  const { status, category, priority, page = 1, limit = 10 } = req.query;
  const where = {};

  if (req.user.role === 'employee') {
    const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) throw new NotFoundError('Employee profile');
    where.employeeId = employee.id;
  } else if (req.query.employeeId) {
    where.employeeId = req.query.employeeId;
  }

  if (status) where.status = status;
  if (category) where.category = category;
  if (priority) where.priority = priority;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, goals] = await Promise.all([
    prisma.goal.count({ where }),
    prisma.goal.findMany({
      where,
      include: {
        employee: { select: { name: true, employeeId: true, department: true } },
        assignedBy: { select: { name: true, employeeId: true } }
      },
      orderBy: { dueDate: 'asc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
  ]);

  paginated(res, goals, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/performance/goals/:id
// @desc    Get single goal
// @access  Private
router.get('/goals/:id', auth, idValidation, catchAsync(async (req, res) => {
  const goal = await prisma.goal.findUnique({
    where: { id: req.params.id },
    include: {
      employee: { select: { name: true, employeeId: true, department: true } },
      assignedBy: { select: { name: true } }
    }
  });

  if (!goal) throw new NotFoundError('Goal');
  
  // Note: For comments, since we used JSON for goals in Prisma, we may not easily populate author names here directly through Prisma relations unless we extract it.
  // Assuming frontend can handle basic JSON or we map it if necessary.
  
  success(res, goal);
}));

// @route   POST /api/performance/goals
// @desc    Create goal
// @access  Private
router.post('/goals', auth, catchAsync(async (req, res) => {
  const { title, description, category, priority, dueDate, keyResults, employeeId } = req.body;

  if (!title) throw new BadRequestError('Goal title is required');

  let targetEmployee;
  if (req.user.role === 'employee') {
    targetEmployee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  } else if (employeeId) {
    targetEmployee = await prisma.employee.findUnique({ where: { id: employeeId } });
  } else {
    targetEmployee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  }

  if (!targetEmployee) throw new NotFoundError('Employee');

  const assignedBy = await prisma.employee.findUnique({ where: { userId: req.user.id } });

  const goal = await prisma.goal.create({
    data: {
      employeeId: targetEmployee.id,
      title,
      description,
      category: category || 'Performance',
      priority: priority || 'medium',
      dueDate: new Date(dueDate),
      keyResults: keyResults || [],
      milestones: [],
      comments: [],
      assignedById: assignedBy?.id,
    },
    include: { employee: { select: { name: true, employeeId: true } } }
  });

  created(res, goal, 'Goal created successfully');
}));

// @route   PUT /api/performance/goals/:id
// @desc    Update goal
// @access  Private
router.put('/goals/:id', auth, idValidation, catchAsync(async (req, res) => {
  const goal = await prisma.goal.findUnique({ where: { id: req.params.id }, include: { employee: true } });

  if (!goal) throw new NotFoundError('Goal');

  if (req.user.role === 'employee') {
    if (goal.employee.userId !== req.user.id) {
      throw new ForbiddenError('You can only update your own goals');
    }
  }

  const data = {};
  const allowedUpdates = ['title', 'description', 'category', 'priority', 'dueDate', 'progress', 'status', 'keyResults', 'milestones'];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      if (field === 'dueDate') {
        data[field] = new Date(req.body[field]);
      } else {
        data[field] = req.body[field];
      }
    }
  });

  // Auto-complete if progress is 100%
  if (req.body.progress === 100 && goal.status !== 'completed') {
    data.status = 'completed';
    // We rely on updatedAt for completedAt
  }

  const updatedGoal = await prisma.goal.update({
    where: { id: req.params.id },
    data,
    include: { employee: { select: { name: true, employeeId: true } } }
  });

  success(res, updatedGoal, 'Goal updated successfully');
}));

// @route   POST /api/performance/goals/:id/comments
// @desc    Add comment to goal
// @access  Private
router.post('/goals/:id/comments', auth, idValidation, catchAsync(async (req, res) => {
  const goal = await prisma.goal.findUnique({ where: { id: req.params.id } });

  if (!goal) throw new NotFoundError('Goal');
  if (!req.body.text) throw new BadRequestError('Comment text is required');

  const author = await prisma.employee.findUnique({ where: { userId: req.user.id }, select: { id: true, name: true } });

  const newComment = {
    authorId: author?.id,
    authorName: author?.name,
    text: req.body.text,
    createdAt: new Date().toISOString(),
  };

  const updatedComments = Array.isArray(goal.comments) ? [...goal.comments, newComment] : [newComment];

  const updatedGoal = await prisma.goal.update({
    where: { id: req.params.id },
    data: { comments: updatedComments }
  });

  success(res, updatedGoal, 'Comment added successfully');
}));

// @route   DELETE /api/performance/goals/:id
// @desc    Delete goal
// @access  Private
router.delete('/goals/:id', auth, idValidation, catchAsync(async (req, res) => {
  const goal = await prisma.goal.findUnique({ where: { id: req.params.id }, include: { employee: true } });

  if (!goal) throw new NotFoundError('Goal');

  if (req.user.role === 'employee') {
    if (goal.employee.userId !== req.user.id) {
      throw new ForbiddenError('You can only delete your own goals');
    }
  }

  await prisma.goal.delete({ where: { id: req.params.id } });

  success(res, null, 'Goal deleted successfully');
}));

// @route   GET /api/performance/my-summary
// @desc    Get current user's performance summary
// @access  Private
router.get('/my-summary', auth, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });

  if (!employee) throw new NotFoundError('Employee profile');

  const currentYear = new Date().getFullYear();

  const [reviews, goals, recentReview] = await Promise.all([
    prisma.performanceReview.findMany({
      where: { employeeId: employee.id, year: currentYear },
      select: { reviewPeriod: true, status: true, overallRating: true }
    }),
    prisma.goal.findMany({ where: { employeeId: employee.id } }),
    prisma.performanceReview.findFirst({
      where: { employeeId: employee.id },
      orderBy: { createdAt: 'desc' }
    }),
  ]);

  const goalSummary = {
    total: goals.length,
    completed: goals.filter(g => g.status === 'completed').length,
    inProgress: goals.filter(g => g.status === 'in-progress' || g.status === 'in_progress').length,
    notStarted: goals.filter(g => g.status === 'not-started' || g.status === 'not_started').length,
    avgProgress: goals.length > 0
      ? Math.round(goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length)
      : 0,
  };

  const ratedReviews = reviews.filter(r => r.overallRating !== null);
  const avgRating = ratedReviews.length > 0
    ? Math.round((ratedReviews.reduce((sum, r) => sum + r.overallRating, 0) / ratedReviews.length) * 10) / 10
    : null;

  success(res, {
    employee: { id: employee.id, name: employee.name },
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
