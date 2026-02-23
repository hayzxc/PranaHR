/**
 * Recruiting Routes
 * Type-safe job postings and candidate management
 */

const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const Candidate = require('../models/Candidate');
const Employee = require('../models/Employee');
const { auth, authorize } = require('../middleware/auth');
const { idValidation, jobValidation, candidateValidation } = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created, paginated } = require('../utils/response');
const { NotFoundError, BadRequestError, ConflictError } = require('../utils/errors');

// ==================== STATS ====================

// @route   GET /api/recruiting/stats
// @desc    Get recruiting statistics
// @access  Private (Admin, HR)
router.get('/stats', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const [jobStats, candidateStats, sourceStats, timeToHire, recentHires] = await Promise.all([
    Job.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalOpenings: { $sum: '$openings' },
          totalApplicants: { $sum: '$applicantCount' },
        },
      },
    ]),
    Candidate.aggregate([
      { $group: { _id: '$stage', count: { $sum: 1 } } },
    ]),
    Candidate.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Candidate.aggregate([
      { $match: { stage: 'hired', hiredAt: { $exists: true } } },
      {
        $project: {
          daysToHire: {
            $divide: [
              { $subtract: ['$hiredAt', '$createdAt'] },
              1000 * 60 * 60 * 24,
            ],
          },
        },
      },
      { $group: { _id: null, avgDays: { $avg: '$daysToHire' } } },
    ]),
    Candidate.find({ stage: 'hired' })
      .populate('job', 'title department')
      .sort({ hiredAt: -1 })
      .limit(5)
      .lean(),
  ]);

  success(res, {
    jobs: jobStats,
    candidates: candidateStats,
    sources: sourceStats,
    avgTimeToHire: Math.round(timeToHire[0]?.avgDays || 0),
    recentHires,
  });
}));

// ==================== JOBS ====================

// @route   GET /api/recruiting/jobs/public
// @desc    Get public job listings (no auth required)
// @access  Public
router.get('/jobs/public', catchAsync(async (req, res) => {
  const { department, type, level, search, page = 1, limit = 20 } = req.query;
  const query = { status: 'open' };

  if (department) {query.department = department;}
  if (type) {query.type = type;}
  if (level) {query.level = level;}

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

  let jobs = await Job.find(query)
    .select('title department location type level description requirements salary.isVisible salary.min salary.max salary.currency openings publishedAt')
    .sort({ publishedAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum)
    .lean();

  // Text search filter
  if (search) {
    const searchLower = search.toLowerCase();
    jobs = jobs.filter(j =>
      j.title.toLowerCase().includes(searchLower) ||
            j.department.toLowerCase().includes(searchLower) ||
            j.location?.toLowerCase().includes(searchLower),
    );
  }

  const total = await Job.countDocuments(query);

  paginated(res, jobs, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/recruiting/jobs
// @desc    Get all jobs
// @access  Private
router.get('/jobs', auth, catchAsync(async (req, res) => {
  const { status, department, type, page = 1, limit = 10 } = req.query;
  const query = {};

  if (status) {query.status = status;}
  if (department) {query.department = department;}
  if (type) {query.type = type;}

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, jobs] = await Promise.all([
    Job.countDocuments(query),
    Job.find(query)
      .populate('hiringManager', 'name employeeId department')
      .populate('createdBy', 'email')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
  ]);

  paginated(res, jobs, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/recruiting/jobs/:id
// @desc    Get single job
// @access  Private
router.get('/jobs/:id', auth, idValidation, catchAsync(async (req, res) => {
  const job = await Job.findById(req.params.id)
    .populate('hiringManager', 'name employeeId email department')
    .populate('createdBy', 'email')
    .lean();

  if (!job) {
    throw new NotFoundError('Job');
  }

  // Get candidate count by stage
  const candidatesByStage = await Candidate.aggregate([
    { $match: { job: job._id } },
    { $group: { _id: '$stage', count: { $sum: 1 } } },
  ]);

  success(res, { ...job, candidatesByStage });
}));

// @route   POST /api/recruiting/jobs
// @desc    Create job
// @access  Private (Admin, HR)
router.post('/jobs', auth, authorize('admin', 'hr'), jobValidation, catchAsync(async (req, res) => {
  const { title, department, location, type, level, description, requirements, responsibilities, skills, salary, benefits, openings, hiringManager, closingDate } = req.body;

  if (!title || !department) {
    throw new BadRequestError('Title and department are required');
  }

  // Validate hiring manager if provided
  if (hiringManager) {
    const manager = await Employee.findById(hiringManager);
    if (!manager) {
      throw new NotFoundError('Hiring manager');
    }
  }

  const job = new Job({
    title,
    department,
    location,
    type: type || 'full_time',
    level: level || 'mid',
    description,
    requirements,
    responsibilities,
    skills,
    salary,
    benefits,
    openings: openings || 1,
    hiringManager,
    closingDate,
    createdBy: req.user._id,
  });

  await job.save();

  const populatedJob = await Job.findById(job._id)
    .populate('hiringManager', 'name')
    .lean();

  created(res, populatedJob, 'Job created successfully');
}));

// @route   PUT /api/recruiting/jobs/:id
// @desc    Update job
// @access  Private (Admin, HR)
router.put('/jobs/:id', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    throw new NotFoundError('Job');
  }

  const allowedUpdates = [
    'title', 'department', 'location', 'type', 'level',
    'description', 'requirements', 'responsibilities', 'skills',
    'salary', 'benefits', 'openings', 'status', 'closingDate', 'hiringManager',
  ];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      job[field] = req.body[field];
    }
  });

  // Set published date when opening
  if (req.body.status === 'open' && !job.publishedAt) {
    job.publishedAt = new Date();
  }

  // Set closed date when closing
  if (req.body.status === 'closed' && !job.closedAt) {
    job.closedAt = new Date();
  }

  await job.save();

  const populatedJob = await Job.findById(job._id)
    .populate('hiringManager', 'name')
    .lean();

  success(res, populatedJob, 'Job updated successfully');
}));

// @route   DELETE /api/recruiting/jobs/:id
// @desc    Delete job
// @access  Private (Admin)
router.delete('/jobs/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const job = await Job.findById(req.params.id);

  if (!job) {
    throw new NotFoundError('Job');
  }

  // Check for active candidates
  const activeCandidates = await Candidate.countDocuments({
    job: job._id,
    stage: { $nin: ['rejected', 'withdrawn'] },
  });

  if (activeCandidates > 0 && !req.query.force) {
    throw new BadRequestError(`Job has ${activeCandidates} active candidates. Use ?force=true to delete anyway.`);
  }

  // Delete associated candidates
  await Candidate.deleteMany({ job: job._id });
  await Job.findByIdAndDelete(job._id);

  success(res, null, 'Job and associated candidates deleted');
}));

// ==================== CANDIDATES ====================

// @route   GET /api/recruiting/jobs/:jobId/candidates
// @desc    Get all candidates for a job
// @access  Private (Admin, HR)
router.get('/jobs/:jobId/candidates', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const { stage, rating, source, page = 1, limit = 20 } = req.query;

  // Verify job exists
  const job = await Job.findById(req.params.jobId);
  if (!job) {
    throw new NotFoundError('Job');
  }

  const query = { job: req.params.jobId };

  if (stage) {query.stage = stage;}
  if (rating) {query.rating = parseInt(rating);}
  if (source) {query.source = source;}

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, candidates] = await Promise.all([
    Candidate.countDocuments(query),
    Candidate.find(query)
      .populate('referredBy', 'name')
      .populate('interviews.interviewers', 'name')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
  ]);

  paginated(res, candidates, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/recruiting/candidates/:id
// @desc    Get single candidate
// @access  Private (Admin, HR)
router.get('/candidates/:id', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const candidate = await Candidate.findById(req.params.id)
    .populate('job', 'title department location type')
    .populate('referredBy', 'name employeeId')
    .populate('interviews.interviewers', 'name email')
    .populate('notes.author', 'email')
    .lean();

  if (!candidate) {
    throw new NotFoundError('Candidate');
  }

  success(res, candidate);
}));

// @route   POST /api/recruiting/jobs/:jobId/candidates
// @desc    Create candidate (application submission)
// @access  Public
router.post('/jobs/:jobId/candidates', candidateValidation, catchAsync(async (req, res) => {
  const job = await Job.findById(req.params.jobId);

  if (!job) {
    throw new NotFoundError('Job');
  }

  if (job.status !== 'open') {
    throw new BadRequestError('This job is not accepting applications');
  }

  const { firstName, lastName, email, phone, resumeUrl, coverLetter, experience, education, skills, expectedSalary, noticePeriod, source } = req.body;

  if (!firstName || !lastName || !email) {
    throw new BadRequestError('First name, last name, and email are required');
  }

  // Check for duplicate application
  const existing = await Candidate.findOne({ job: req.params.jobId, email: email.toLowerCase() });
  if (existing) {
    throw new ConflictError('You have already applied for this position');
  }

  const candidate = new Candidate({
    job: req.params.jobId,
    firstName,
    lastName,
    email: email.toLowerCase(),
    phone,
    resumeUrl,
    coverLetter,
    experience,
    education,
    skills,
    expectedSalary,
    noticePeriod,
    source: source || 'direct',
  });

  await candidate.save();

  // Update applicant count
  job.applicantCount = (job.applicantCount || 0) + 1;
  await job.save();

  created(res, {
    message: 'Application submitted successfully',
    candidateId: candidate._id,
    applicationDate: candidate.createdAt,
  });
}));

// @route   PUT /api/recruiting/candidates/:id
// @desc    Update candidate
// @access  Private (Admin, HR)
router.put('/candidates/:id', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);

  if (!candidate) {
    throw new NotFoundError('Candidate');
  }

  const allowedUpdates = [
    'firstName', 'lastName', 'email', 'phone', 'resumeUrl',
    'experience', 'education', 'skills', 'expectedSalary',
    'noticePeriod', 'stage', 'rating', 'rejectionReason', 'source',
  ];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      candidate[field] = req.body[field];
    }
  });

  if (req.body.stage === 'hired' && !candidate.hiredAt) {
    candidate.hiredAt = new Date();
  }

  if (req.body.stage === 'rejected' && !candidate.rejectedAt) {
    candidate.rejectedAt = new Date();
  }

  await candidate.save();

  const populatedCandidate = await Candidate.findById(candidate._id)
    .populate('job', 'title department')
    .lean();

  success(res, populatedCandidate, 'Candidate updated successfully');
}));

// @route   PUT /api/recruiting/candidates/:id/stage
// @desc    Move candidate to next stage
// @access  Private (Admin, HR)
router.put('/candidates/:id/stage', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);

  if (!candidate) {
    throw new NotFoundError('Candidate');
  }

  const { stage, rejectionReason, notes } = req.body;

  if (!stage) {
    throw new BadRequestError('Stage is required');
  }

  const validStages = ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired', 'rejected', 'withdrawn'];
  if (!validStages.includes(stage)) {
    throw new BadRequestError(`Invalid stage. Must be one of: ${validStages.join(', ')}`);
  }

  const previousStage = candidate.stage;
  candidate.stage = stage;

  if (stage === 'rejected') {
    candidate.rejectedAt = new Date();
    candidate.rejectionReason = rejectionReason || 'Not specified';
  }

  if (stage === 'hired') {
    candidate.hiredAt = new Date();
  }

  // Add stage change to notes
  if (notes) {
    candidate.notes.push({
      author: req.user._id,
      text: notes,
      type: 'stage_change',
      metadata: { from: previousStage, to: stage },
    });
  }

  await candidate.save();

  success(res, candidate, `Candidate moved to ${stage} stage`);
}));

// @route   POST /api/recruiting/candidates/:id/interviews
// @desc    Schedule interview
// @access  Private (Admin, HR)
router.post('/candidates/:id/interviews', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);

  if (!candidate) {
    throw new NotFoundError('Candidate');
  }

  const { type, scheduledAt, interviewers, location, notes, duration } = req.body;

  if (!type || !scheduledAt) {
    throw new BadRequestError('Interview type and scheduled time are required');
  }

  const scheduledDate = new Date(scheduledAt);
  if (scheduledDate < new Date()) {
    throw new BadRequestError('Interview cannot be scheduled in the past');
  }

  // Validate interviewers
  if (interviewers && interviewers.length > 0) {
    const validInterviewers = await Employee.find({ _id: { $in: interviewers } });
    if (validInterviewers.length !== interviewers.length) {
      throw new NotFoundError('One or more interviewers');
    }
  }

  candidate.interviews.push({
    type,
    scheduledAt: scheduledDate,
    interviewers,
    location,
    notes,
    duration: duration || 60,
    status: 'scheduled',
  });

  // Auto-advance stage to interview if needed
  if (['applied', 'screening'].includes(candidate.stage)) {
    candidate.stage = 'interview';
  }

  await candidate.save();

  const populatedCandidate = await Candidate.findById(candidate._id)
    .populate('interviews.interviewers', 'name email')
    .lean();

  created(res, populatedCandidate, 'Interview scheduled successfully');
}));

// @route   PUT /api/recruiting/candidates/:id/interviews/:interviewId
// @desc    Update interview
// @access  Private (Admin, HR)
router.put('/candidates/:id/interviews/:interviewId', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);

  if (!candidate) {
    throw new NotFoundError('Candidate');
  }

  const interview = candidate.interviews.id(req.params.interviewId);
  if (!interview) {
    throw new NotFoundError('Interview');
  }

  const allowedUpdates = ['scheduledAt', 'feedback', 'rating', 'status', 'location', 'notes', 'decision'];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      interview[field] = req.body[field];
    }
  });

  if (req.body.status === 'completed') {
    interview.completedAt = new Date();
  }

  await candidate.save();

  success(res, candidate, 'Interview updated successfully');
}));

// @route   POST /api/recruiting/candidates/:id/notes
// @desc    Add note to candidate
// @access  Private (Admin, HR)
router.post('/candidates/:id/notes', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);

  if (!candidate) {
    throw new NotFoundError('Candidate');
  }

  if (!req.body.text) {
    throw new BadRequestError('Note text is required');
  }

  candidate.notes.push({
    author: req.user._id,
    text: req.body.text,
    type: req.body.type || 'general',
    createdAt: new Date(),
  });

  await candidate.save();

  const populatedCandidate = await Candidate.findById(candidate._id)
    .populate('notes.author', 'email')
    .lean();

  created(res, populatedCandidate, 'Note added successfully');
}));

// @route   PUT /api/recruiting/candidates/:id/offer
// @desc    Create/Update offer
// @access  Private (Admin, HR)
router.put('/candidates/:id/offer', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);

  if (!candidate) {
    throw new NotFoundError('Candidate');
  }

  const { salary, startDate, position, department, benefits, expiresAt, status, notes } = req.body;

  candidate.offer = {
    ...candidate.offer,
    salary,
    startDate: startDate ? new Date(startDate) : candidate.offer?.startDate,
    position,
    department,
    benefits,
    expiresAt: expiresAt ? new Date(expiresAt) : candidate.offer?.expiresAt,
    status: status || 'pending',
    createdAt: candidate.offer?.createdAt || new Date(),
    createdBy: req.user._id,
    notes,
  };

  // Update stage when offer is created
  if (['pending', 'sent'].includes(status)) {
    candidate.stage = 'offer';
  }

  // Handle offer acceptance
  if (status === 'accepted') {
    candidate.stage = 'hired';
    candidate.hiredAt = new Date();
  }

  await candidate.save();

  success(res, candidate, 'Offer updated successfully');
}));

// @route   DELETE /api/recruiting/candidates/:id
// @desc    Delete candidate
// @access  Private (Admin)
router.delete('/candidates/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const candidate = await Candidate.findById(req.params.id);

  if (!candidate) {
    throw new NotFoundError('Candidate');
  }

  // Update job applicant count
  await Job.findByIdAndUpdate(candidate.job, {
    $inc: { applicantCount: -1 },
  });

  await Candidate.findByIdAndDelete(req.params.id);

  success(res, null, 'Candidate deleted');
}));

module.exports = router;
