/**
 * OKR & KPI Routes
 * Objectives & Key Results + Key Performance Indicators
 * PONYTAIL FIX: Relational KeyResult Management & Prisma Integration
 */

const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma').default;
const { auth, authorize } = require('../middleware/auth');
const {
  idValidation,
  okrCreateValidation,
  okrUpdateValidation,
  kpiCreateValidation,
  kpiEntryValidation,
} = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created, paginated } = require('../utils/response');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');

// ==================== HELPER ====================
const calculateOkrScore = (keyResults) => {
  if (!keyResults || keyResults.length === 0) return 0;
  
  let totalWeight = 0;
  let totalWeightedScore = 0;
  
  keyResults.forEach(kr => {
    const weight = kr.weight || 1;
    totalWeight += weight;
    
    let progress = 0;
    if (kr.targetValue > 0) {
      progress = Math.min((kr.currentValue || 0) / kr.targetValue * 100, 100);
    }
    totalWeightedScore += (progress * weight);
  });
  
  return totalWeight > 0 ? Math.round(totalWeightedScore / totalWeight) : 0;
};

// ==================== OKR STATS ====================
router.get('/stats', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const year = parseInt(req.query.year) || new Date().getFullYear();

  const okrs = await prisma.oKR.findMany({
    where: { year },
    include: { owner: { select: { department: true } } }
  });
  const kpis = await prisma.kPI.findMany(); // Assuming KPI trend might need manual calc if not in schema

  const statusObj = {};
  const cycleObj = {};
  const deptObj = {};
  
  okrs.forEach(o => {
    statusObj[o.status] = (statusObj[o.status] || { count: 0, totalScore: 0 });
    statusObj[o.status].count++;
    statusObj[o.status].totalScore += o.score;
    
    cycleObj[o.cycle] = (cycleObj[o.cycle] || { count: 0, totalScore: 0 });
    cycleObj[o.cycle].count++;
    cycleObj[o.cycle].totalScore += o.score;

    if (o.status === 'active' || o.status === 'completed') {
      const dept = o.owner?.department;
      if (dept) {
        deptObj[dept] = (deptObj[dept] || { count: 0, totalScore: 0 });
        deptObj[dept].count++;
        deptObj[dept].totalScore += o.score;
      }
    }
  });

  const statusBreakdown = Object.entries(statusObj).map(([id, d]) => ({ _id: id, count: d.count, avgScore: d.count > 0 ? d.totalScore / d.count : 0 }));
  const cycleBreakdown = Object.entries(cycleObj).map(([id, d]) => ({ _id: id, count: d.count, avgScore: d.count > 0 ? d.totalScore / d.count : 0 })).sort((a,b) => a._id.localeCompare(b._id));
  const avgScoreByDept = Object.entries(deptObj).map(([id, d]) => ({ _id: id, count: d.count, avgScore: d.count > 0 ? d.totalScore / d.count : 0 })).sort((a,b) => b.avgScore - a.avgScore);

  success(res, { year, totalOKRs: okrs.length, statusBreakdown, avgScoreByDept, cycleBreakdown, kpiTrends: [] });
}));

// ==================== OKR LIST & CREATE ====================
router.get('/', auth, catchAsync(async (req, res) => {
  const { cycle, year, status, category, employeeId, page = 1, limit = 10 } = req.query;
  const where = {};

  if (req.user.role === 'employee') {
    const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!emp) throw new NotFoundError('Employee profile');
    where.ownerId = emp.id;
  } else if (employeeId) {
    where.ownerId = employeeId;
  }

  if (cycle) where.cycle = cycle;
  if (year) where.year = parseInt(year);
  if (status) where.status = status;
  if (category) where.category = category;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, okrs] = await Promise.all([
    prisma.oKR.count({ where }),
    prisma.oKR.findMany({
      where,
      include: {
        owner: { select: { name: true, employeeId: true, department: true, position: true } },
        parentObjective: { select: { title: true, score: true } },
        keyResults: true
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    })
  ]);

  paginated(res, okrs, { total, page: pageNum, limit: limitNum });
}));

router.post('/', auth, okrCreateValidation, catchAsync(async (req, res) => {
  const { title, description, cycle, year, category, keyResults, parentObjective, employeeId } = req.body;

  let owner;
  if (req.user.role === 'employee') {
    owner = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  } else if (employeeId) {
    owner = await prisma.employee.findUnique({ where: { id: employeeId } });
  } else {
    owner = await prisma.employee.findUnique({ where: { userId: req.user.id } });
  }

  if (!owner) throw new NotFoundError('Employee');

  const createdBy = await prisma.employee.findUnique({ where: { userId: req.user.id } });

  const okr = await prisma.oKR.create({
    data: {
      title,
      description,
      ownerId: owner.id,
      cycle,
      year: year || new Date().getFullYear(),
      category: category || 'individual',
      parentObjectiveId: parentObjective || null,
      createdById: createdBy?.id,
      keyResults: {
        create: (keyResults || []).map(kr => ({
          title: kr.title,
          targetValue: kr.targetValue,
          unit: kr.unit || '%',
          weight: kr.weight || 1
        }))
      }
    },
    include: {
      owner: { select: { name: true, employeeId: true, department: true } },
      keyResults: true
    }
  });

  created(res, okr, 'OKR created successfully');
}));

// ==================== KPI CRUD ====================
router.get('/kpis', auth, catchAsync(async (req, res) => {
  const { category, department, employeeId, page = 1, limit = 10 } = req.query;
  const where = {};

  if (req.user.role === 'employee') {
    const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!emp) throw new NotFoundError('Employee profile');
    where.employeeId = emp.id;
  } else if (employeeId) {
    where.employeeId = employeeId;
  }

  // Assuming category is title/description based or we skip if not in prisma KPI
  if (department) where.department = department;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  const [total, kpis] = await Promise.all([
    prisma.kPI.count({ where }),
    prisma.kPI.findMany({
      where,
      include: { employee: { select: { name: true, employeeId: true, department: true, position: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    })
  ]);

  paginated(res, kpis, { total, page: pageNum, limit: limitNum });
}));

router.post('/kpis', auth, authorize('hr', 'admin'), kpiCreateValidation, catchAsync(async (req, res) => {
  const { name, description, unit, targetValue, frequency, department, employeeId } = req.body;

  let employee;
  if (employeeId) {
    employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    if (!employee) throw new NotFoundError('Employee');
  } else {
    employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!employee) throw new NotFoundError('Employee profile');
  }

  const kpi = await prisma.kPI.create({
    data: {
      title: name,
      description,
      employeeId: employee.id,
      department: department || employee.department,
      unit,
      targetValue,
      frequency: frequency || 'monthly',
      entries: []
    },
    include: { employee: { select: { name: true, employeeId: true, department: true } } }
  });

  created(res, kpi, 'KPI created successfully');
}));

router.put('/kpis/:id', auth, authorize('hr', 'admin'), idValidation, catchAsync(async (req, res) => {
  const kpi = await prisma.kPI.findUnique({ where: { id: req.params.id } });
  if (!kpi) throw new NotFoundError('KPI');

  const data = {};
  if (req.body.name !== undefined) data.title = req.body.name;
  if (req.body.description !== undefined) data.description = req.body.description;
  if (req.body.unit !== undefined) data.unit = req.body.unit;
  if (req.body.targetValue !== undefined) data.targetValue = req.body.targetValue;
  if (req.body.frequency !== undefined) data.frequency = req.body.frequency;
  if (req.body.department !== undefined) data.department = req.body.department;

  const updatedKpi = await prisma.kPI.update({
    where: { id: req.params.id },
    data,
    include: { employee: { select: { name: true, employeeId: true, department: true } } }
  });

  success(res, updatedKpi, 'KPI updated successfully');
}));

router.post('/kpis/:id/entries', auth, kpiEntryValidation, catchAsync(async (req, res) => {
  const kpi = await prisma.kPI.findUnique({ where: { id: req.params.id } });
  if (!kpi) throw new NotFoundError('KPI');

  const isAdmin = ['hr', 'admin'].includes(req.user.role);
  if (!isAdmin) {
    const emp = await prisma.employee.findUnique({ where: { userId: req.user.id } });
    if (!emp || kpi.employeeId !== emp.id) {
      throw new ForbiddenError('You can only add entries to your own KPIs');
    }
  }

  const newEntry = {
    value: req.body.value,
    date: req.body.date ? new Date(req.body.date).toISOString() : new Date().toISOString(),
    notes: req.body.notes || '',
    recordedById: req.user.id
  };

  const currentEntries = Array.isArray(kpi.entries) ? kpi.entries : [];
  
  const updatedKpi = await prisma.kPI.update({
    where: { id: req.params.id },
    data: { entries: [...currentEntries, newEntry] },
    include: { employee: { select: { name: true, employeeId: true, department: true } } }
  });

  success(res, updatedKpi, 'KPI entry added successfully');
}));

router.delete('/kpis/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  await prisma.kPI.delete({ where: { id: req.params.id } }).catch(() => {
    throw new NotFoundError('KPI');
  });
  success(res, null, 'KPI deleted successfully');
}));

// ==================== OKR SINGLE ITEM ====================
router.get('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const okr = await prisma.oKR.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { userId: true, name: true, employeeId: true, department: true, position: true, email: true } },
      parentObjective: { select: { title: true, score: true, status: true } },
      createdBy: { select: { name: true, employeeId: true } },
      keyResults: true
    }
  });

  if (!okr) throw new NotFoundError('OKR');

  if (req.user.role === 'employee') {
    if (!okr.owner || okr.owner.userId !== req.user.id) {
      throw new ForbiddenError('You can only view your own OKRs');
    }
  }

  success(res, okr);
}));

router.put('/:id', auth, idValidation, okrUpdateValidation, catchAsync(async (req, res) => {
  let okr = await prisma.oKR.findUnique({ where: { id: req.params.id }, include: { owner: true } });
  if (!okr) throw new NotFoundError('OKR');

  if (req.user.role === 'employee') {
    if (okr.owner.userId !== req.user.id) {
      throw new ForbiddenError('You can only update your own OKRs');
    }
  }

  const data = {};
  const allowed = ['title', 'description', 'cycle', 'year', 'category', 'status', 'parentObjective'];
  allowed.forEach(f => {
    if (req.body[f] !== undefined) {
      if (f === 'parentObjective') data.parentObjectiveId = req.body[f];
      else data[f] = req.body[f];
    }
  });

  // Handle KeyResults update if passed as a whole array
  if (req.body.keyResults && Array.isArray(req.body.keyResults)) {
    // Basic implementation: delete existing and recreate. For a real prod app, use upsert.
    await prisma.keyResult.deleteMany({ where: { okrId: okr.id } });
    data.keyResults = {
      create: req.body.keyResults.map(kr => ({
        title: kr.title,
        targetValue: kr.targetValue,
        currentValue: kr.currentValue || 0,
        unit: kr.unit || '%',
        weight: kr.weight || 1,
        status: kr.status || 'not-started'
      }))
    };
  }

  okr = await prisma.oKR.update({
    where: { id: req.params.id },
    data,
    include: { owner: { select: { name: true, employeeId: true, department: true } }, keyResults: true }
  });

  // PONYTAIL FIX: Recalculate score automatically
  const score = calculateOkrScore(okr.keyResults);
  if (score !== okr.score) {
    okr = await prisma.oKR.update({
      where: { id: okr.id },
      data: { score },
      include: { owner: { select: { name: true, employeeId: true, department: true } }, keyResults: true }
    });
  }

  success(res, okr, 'OKR updated successfully');
}));

router.put('/:id/key-results/:krId', auth, catchAsync(async (req, res) => {
  const okr = await prisma.oKR.findUnique({ where: { id: req.params.id }, include: { owner: true } });
  if (!okr) throw new NotFoundError('OKR');

  if (req.user.role === 'employee') {
    if (okr.owner.userId !== req.user.id) {
      throw new ForbiddenError('You can only update your own OKRs');
    }
  }

  const kr = await prisma.keyResult.findUnique({ where: { id: req.params.krId } });
  if (!kr || kr.okrId !== okr.id) throw new NotFoundError('Key Result');

  const data = {};
  if (req.body.currentValue !== undefined) data.currentValue = req.body.currentValue;
  if (req.body.title !== undefined) data.title = req.body.title;
  if (req.body.targetValue !== undefined) data.targetValue = req.body.targetValue;
  if (req.body.unit !== undefined) data.unit = req.body.unit;
  if (req.body.weight !== undefined) data.weight = req.body.weight;
  if (req.body.status !== undefined) data.status = req.body.status;

  await prisma.keyResult.update({ where: { id: kr.id }, data });

  // PONYTAIL FIX: Recalculate OKR score
  const allKrs = await prisma.keyResult.findMany({ where: { okrId: okr.id } });
  const score = calculateOkrScore(allKrs);
  
  const updatedOkr = await prisma.oKR.update({
    where: { id: okr.id },
    data: { score },
    include: { owner: { select: { name: true, employeeId: true, department: true } }, keyResults: true }
  });

  success(res, updatedOkr, 'Key result updated successfully');
}));

router.delete('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const okr = await prisma.oKR.findUnique({ where: { id: req.params.id }, include: { owner: true } });
  if (!okr) throw new NotFoundError('OKR');

  if (req.user.role === 'employee') {
    if (okr.owner.userId !== req.user.id) {
      throw new ForbiddenError('You can only delete your own OKRs');
    }
  }

  await prisma.oKR.delete({ where: { id: req.params.id } });
  success(res, null, 'OKR deleted successfully');
}));

module.exports = router;
