/**
 * Recruiting Routes
 * Type-safe job postings and candidate management
 * PONYTAIL FIX: Prisma Integration & Strict Schema Mapping
 */

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma').default;
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
  const [jobs, candidates, recentHires] = await Promise.all([
    prisma.job.findMany({ include: { _count: { select: { candidates: true } } } }),
    prisma.candidate.findMany(),
    prisma.candidate.findMany({
      where: { stage: 'hired' },
      include: { job: { select: { title: true, department: true } } },
      orderBy: { updatedAt: 'desc' },
      take: 5
    })
  ]);

  const jobStatsObj = {};
  let totalOpenings = 0; // Schema lacks 'openings', defaulting to 1 per job
  let totalApplicants = 0;

  jobs.forEach(j => {
    jobStatsObj[j.status] = (jobStatsObj[j.status] || 0) + 1;
    totalOpenings += 1;
    totalApplicants += j._count.candidates;
  });

  const jobStats = Object.entries(jobStatsObj).map(([id, count]) => ({
    _id: id, count, totalOpenings, totalApplicants
  }));

  const candidateStatsObj = {};
  const sourceStatsObj = {};
  let timeToHireTotal = 0;
  let hiredCount = 0;

  candidates.forEach(c => {
    candidateStatsObj[c.stage] = (candidateStatsObj[c.stage] || 0) + 1;
    sourceStatsObj[c.source] = (sourceStatsObj[c.source] || 0) + 1;

    if (c.stage === 'hired') {
      const days = (new Date(c.updatedAt) - new Date(c.createdAt)) / (1000 * 60 * 60 * 24);
      timeToHireTotal += days;
      hiredCount++;
    }
  });

  const candidateStats = Object.entries(candidateStatsObj).map(([id, count]) => ({ _id: id, count }));
  const sourceStats = Object.entries(sourceStatsObj).map(([id, count]) => ({ _id: id, count })).sort((a,b) => b.count - a.count);

  success(res, {
    jobs: jobStats,
    candidates: candidateStats,
    sources: sourceStats,
    avgTimeToHire: hiredCount > 0 ? Math.round(timeToHireTotal / hiredCount) : 0,
    recentHires,
  });
}));

// ==================== JOBS ====================

// @route   GET /api/recruiting/jobs/public
// @desc    Get public job listings (no auth required)
// @access  Public
router.get('/jobs/public', catchAsync(async (req, res) => {
  const { department, type, search, page = 1, limit = 20 } = req.query;
  const where = { status: 'open' };

  if (department) where.department = department;
  if (type) where.type = type;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

  let jobs = await prisma.job.findMany({
    where,
    select: { id: true, title: true, department: true, location: true, type: true, description: true, requirements: true, salaryRange: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  if (search) {
    const searchLower = search.toLowerCase();
    jobs = jobs.filter(j =>
      j.title.toLowerCase().includes(searchLower) ||
      j.department.toLowerCase().includes(searchLower) ||
      j.location?.toLowerCase().includes(searchLower)
    );
  }

  // Handle pagination in memory for text search
  const total = jobs.length;
  const paginatedJobs = jobs.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  paginated(res, paginatedJobs, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/recruiting/jobs
// @desc    Get all jobs
// @access  Private
router.get('/jobs', auth, catchAsync(async (req, res) => {
  const { status, department, type, page = 1, limit = 10 } = req.query;
  const where = {};

  if (status) where.status = status;
  if (department) where.department = department;
  if (type) where.type = type;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      include: { createdBy: { select: { name: true, email: true } }, _count: { select: { candidates: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
  ]);

  paginated(res, jobs, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/recruiting/jobs/:id
// @desc    Get single job
// @access  Private
router.get('/jobs/:id', auth, idValidation, catchAsync(async (req, res) => {
  const job = await prisma.job.findUnique({
    where: { id: req.params.id },
    include: { createdBy: { select: { name: true, email: true } } }
  });

  if (!job) throw new NotFoundError('Job');

  const candidates = await prisma.candidate.findMany({ where: { jobId: job.id } });
  const stageObj = {};
  candidates.forEach(c => {
    stageObj[c.stage] = (stageObj[c.stage] || 0) + 1;
  });
  const candidatesByStage = Object.entries(stageObj).map(([id, count]) => ({ _id: id, count }));

  success(res, { ...job, candidatesByStage });
}));

// @route   POST /api/recruiting/jobs
// @desc    Create job
// @access  Private (Admin, HR)
router.post('/jobs', auth, authorize('admin', 'hr'), jobValidation, catchAsync(async (req, res) => {
  const { title, department, location, type, description, requirements, responsibilities, salary } = req.body;

  if (!title || !department || !type || !description) {
    throw new BadRequestError('Title, department, type, and description are required');
  }

  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  if (!employee) throw new NotFoundError('Employee profile required to create jobs');

  // Map Mongoose salary object to Prisma salaryRange string
  let salaryRange = null;
  if (salary && typeof salary === 'object') {
    salaryRange = `${salary.currency || '$'}${salary.min || 0} - ${salary.max || 0}`;
  } else if (typeof salary === 'string') {
    salaryRange = salary;
  }

  const job = await prisma.job.create({
    data: {
      title,
      department,
      location: location || 'Remote',
      type,
      description,
      requirements: requirements || [],
      responsibilities: responsibilities || [],
      salaryRange,
      createdById: employee.id,
      status: 'open',
    },
    include: { createdBy: { select: { name: true } } }
  });

  created(res, job, 'Job created successfully');
}));

// @route   PUT /api/recruiting/jobs/:id
// @desc    Update job
// @access  Private (Admin, HR)
router.put('/jobs/:id', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });

  if (!job) throw new NotFoundError('Job');

  const data = {};
  const allowed = ['title', 'department', 'location', 'type', 'description', 'requirements', 'responsibilities', 'status'];
  
  allowed.forEach(field => {
    if (req.body[field] !== undefined) data[field] = req.body[field];
  });

  if (req.body.salary) {
    if (typeof req.body.salary === 'object') {
      data.salaryRange = `${req.body.salary.currency || '$'}${req.body.salary.min || 0} - ${req.body.salary.max || 0}`;
    } else {
      data.salaryRange = req.body.salary;
    }
  }

  const updatedJob = await prisma.job.update({
    where: { id: req.params.id },
    data,
    include: { createdBy: { select: { name: true } } }
  });

  success(res, updatedJob, 'Job updated successfully');
}));

// @route   DELETE /api/recruiting/jobs/:id
// @desc    Delete job
// @access  Private (Admin)
router.delete('/jobs/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.id } });

  if (!job) throw new NotFoundError('Job');

  const activeCandidates = await prisma.candidate.count({
    where: { jobId: job.id, stage: { notIn: ['rejected', 'withdrawn'] } }
  });

  if (activeCandidates > 0 && req.query.force !== 'true') {
    throw new BadRequestError(`Job has ${activeCandidates} active candidates. Use ?force=true to delete anyway.`);
  }

  // Delete associated candidates first (if Cascade isn't supported properly by DB natively)
  await prisma.candidate.deleteMany({ where: { jobId: job.id } });
  await prisma.job.delete({ where: { id: job.id } });

  success(res, null, 'Job and associated candidates deleted');
}));

// ==================== CANDIDATES ====================

// @route   GET /api/recruiting/jobs/:jobId/candidates
// @desc    Get all candidates for a job
// @access  Private (Admin, HR)
router.get('/jobs/:jobId/candidates', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const { stage, source, page = 1, limit = 20 } = req.query;

  const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });
  if (!job) throw new NotFoundError('Job');

  const where = { jobId: job.id };

  if (stage) where.stage = stage;
  if (source) where.source = source;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, candidates] = await Promise.all([
    prisma.candidate.count({ where }),
    prisma.candidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    })
  ]);

  paginated(res, candidates, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/recruiting/candidates/:id
// @desc    Get single candidate
// @access  Private (Admin, HR)
router.get('/candidates/:id', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const candidate = await prisma.candidate.findUnique({
    where: { id: req.params.id },
    include: { job: { select: { title: true, department: true, location: true, type: true } } }
  });

  if (!candidate) throw new NotFoundError('Candidate');

  success(res, candidate);
}));

// @route   POST /api/recruiting/jobs/:jobId/candidates
// @desc    Create candidate (application submission)
// @access  Public
router.post('/jobs/:jobId/candidates', candidateValidation, catchAsync(async (req, res) => {
  const job = await prisma.job.findUnique({ where: { id: req.params.jobId } });

  if (!job) throw new NotFoundError('Job');
  if (job.status !== 'open') throw new BadRequestError('This job is not accepting applications');

  const { firstName, lastName, email, phone, resumeUrl, resume, coverLetter, source } = req.body;

  if (!firstName || !lastName || !email) {
    throw new BadRequestError('First name, last name, and email are required');
  }

  const emailLower = email.toLowerCase();
  const existing = await prisma.candidate.findFirst({
    where: { jobId: job.id, email: emailLower }
  });

  if (existing) throw new ConflictError('You have already applied for this position');

  // Mongoose used resumeUrl, Prisma uses resume. We accept both for backwards compat.
  const finalResume = resume || resumeUrl || '';

  const candidate = await prisma.candidate.create({
    data: {
      jobId: job.id,
      firstName,
      lastName,
      email: emailLower,
      phone: phone || '',
      resume: finalResume,
      coverLetter: coverLetter || null,
      source: source || 'website',
      stage: 'applied',
      interviews: [],
      notes: [],
    }
  });

  created(res, {
    message: 'Application submitted successfully',
    candidateId: candidate.id,
    applicationDate: candidate.createdAt,
  });
}));

// @route   PUT /api/recruiting/candidates/:id
// @desc    Update candidate
// @access  Private (Admin, HR)
router.put('/candidates/:id', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const candidate = await prisma.candidate.findUnique({ where: { id: req.params.id } });

  if (!candidate) throw new NotFoundError('Candidate');

  const data = {};
  const allowed = ['firstName', 'lastName', 'email', 'phone', 'resume', 'coverLetter', 'stage', 'rejectionReason', 'source'];

  allowed.forEach(f => {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  });

  // Handle Mongoose backwards compatibility
  if (req.body.resumeUrl !== undefined) data.resume = req.body.resumeUrl;

  const updatedCandidate = await prisma.candidate.update({
    where: { id: req.params.id },
    data,
    include: { job: { select: { title: true, department: true } } }
  });

  success(res, updatedCandidate, 'Candidate updated successfully');
}));

// @route   PUT /api/recruiting/candidates/:id/stage
// @desc    Move candidate to next stage
// @access  Private (Admin, HR)
router.put('/candidates/:id/stage', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const candidate = await prisma.candidate.findUnique({ where: { id: req.params.id } });

  if (!candidate) throw new NotFoundError('Candidate');

  const { stage, rejectionReason, notes } = req.body;

  if (!stage) throw new BadRequestError('Stage is required');

  const validStages = ['applied', 'screening', 'interviewing', 'interview', 'offer', 'offered', 'hired', 'rejected', 'withdrawn'];
  if (!validStages.includes(stage)) {
    throw new BadRequestError(`Invalid stage. Must be one of: ${validStages.join(', ')}`);
  }

  const previousStage = candidate.stage;
  const data = { stage: stage === 'interview' ? 'interviewing' : stage === 'offer' ? 'offered' : stage };

  if (stage === 'rejected') {
    data.rejectionReason = rejectionReason || 'Not specified';
  }

  // Handle notes
  if (notes) {
    const newNote = {
      authorId: req.user.id,
      text: notes,
      date: new Date().toISOString(),
      metadata: { from: previousStage, to: stage }
    };
    data.notes = Array.isArray(candidate.notes) ? [...candidate.notes, newNote] : [newNote];
  }

  const updatedCandidate = await prisma.candidate.update({
    where: { id: req.params.id },
    data
  });

  success(res, updatedCandidate, `Candidate moved to ${stage} stage`);
}));

// @route   POST /api/recruiting/candidates/:id/interviews
// @desc    Schedule interview
// @access  Private (Admin, HR)
router.post('/candidates/:id/interviews', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const candidate = await prisma.candidate.findUnique({ where: { id: req.params.id } });

  if (!candidate) throw new NotFoundError('Candidate');

  const { type, scheduledAt, interviewers, notes } = req.body;

  if (!type || !scheduledAt) throw new BadRequestError('Interview type and scheduled time are required');

  const newInterview = {
    type,
    date: new Date(scheduledAt).toISOString(),
    interviewerId: Array.isArray(interviewers) ? interviewers[0] : interviewers,
    notes: notes || '',
    result: 'scheduled'
  };

  const data = {
    interviews: Array.isArray(candidate.interviews) ? [...candidate.interviews, newInterview] : [newInterview]
  };

  if (['applied', 'screening'].includes(candidate.stage)) {
    data.stage = 'interviewing';
  }

  const updatedCandidate = await prisma.candidate.update({
    where: { id: req.params.id },
    data
  });

  created(res, updatedCandidate, 'Interview scheduled successfully');
}));

// @route   POST /api/recruiting/candidates/:id/notes
// @desc    Add note to candidate
// @access  Private (Admin, HR)
router.post('/candidates/:id/notes', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const candidate = await prisma.candidate.findUnique({ where: { id: req.params.id } });

  if (!candidate) throw new NotFoundError('Candidate');
  if (!req.body.text) throw new BadRequestError('Note text is required');

  const newNote = {
    text: req.body.text,
    authorId: req.user.id,
    date: new Date().toISOString()
  };

  const updatedCandidate = await prisma.candidate.update({
    where: { id: req.params.id },
    data: {
      notes: Array.isArray(candidate.notes) ? [...candidate.notes, newNote] : [newNote]
    }
  });

  created(res, updatedCandidate, 'Note added successfully');
}));

// @route   PUT /api/recruiting/candidates/:id/offer
// @desc    Create/Update offer
// @access  Private (Admin, HR)
router.put('/candidates/:id/offer', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const candidate = await prisma.candidate.findUnique({ where: { id: req.params.id } });

  if (!candidate) throw new NotFoundError('Candidate');

  const { salary, startDate, status } = req.body;

  const data = {
    offerDetails: {
      salary: salary || '',
      expectedStartDate: startDate ? new Date(startDate).toISOString() : '',
      status: status || 'pending'
    }
  };

  if (['pending', 'sent'].includes(status)) data.stage = 'offered';
  if (status === 'accepted') data.stage = 'hired';

  const updatedCandidate = await prisma.candidate.update({
    where: { id: req.params.id },
    data
  });

  success(res, updatedCandidate, 'Offer updated successfully');
}));

// @route   DELETE /api/recruiting/candidates/:id
// @desc    Delete candidate
// @access  Private (Admin)
router.delete('/candidates/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  await prisma.candidate.delete({ where: { id: req.params.id } }).catch(() => {
    throw new NotFoundError('Candidate');
  });

  success(res, null, 'Candidate deleted');
}));

module.exports = router;
