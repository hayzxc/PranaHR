/**
 * OKR & KPI Routes
 * Objectives & Key Results + Key Performance Indicators
 */

const express = require('express');
const router = express.Router();
const OKR = require('../models/OKR');
const KPI = require('../models/KPI');
const Employee = require('../models/Employee');
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

const getEmployeeForUser = async (userId) => {
    return Employee.findOne({ userId }).lean();
};

// ==================== OKR STATS ====================

// @route   GET /api/okr/stats
// @access  Private (Admin, HR)
router.get('/stats', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const [statusBreakdown, avgScoreByDept, cycleBreakdown, totalOKRs, kpiStats] = await Promise.all([
        OKR.aggregate([
            { $match: { year } },
            { $group: { _id: '$status', count: { $sum: 1 }, avgScore: { $avg: '$score' } } },
        ]),
        OKR.aggregate([
            { $match: { year, status: { $in: ['active', 'completed'] } } },
            { $lookup: { from: 'employees', localField: 'owner', foreignField: '_id', as: 'ownerData' } },
            { $unwind: '$ownerData' },
            { $group: { _id: '$ownerData.department', avgScore: { $avg: '$score' }, count: { $sum: 1 } } },
            { $sort: { avgScore: -1 } },
        ]),
        OKR.aggregate([
            { $match: { year } },
            { $group: { _id: '$cycle', count: { $sum: 1 }, avgScore: { $avg: '$score' } } },
            { $sort: { _id: 1 } },
        ]),
        OKR.countDocuments({ year }),
        KPI.aggregate([
            { $match: { status: 'active' } },
            { $group: { _id: '$trend', count: { $sum: 1 } } },
        ]),
    ]);

    success(res, { year, totalOKRs, statusBreakdown, avgScoreByDept, cycleBreakdown, kpiTrends: kpiStats });
}));

// ==================== OKR LIST & CREATE ====================

// @route   GET /api/okr
router.get('/', auth, catchAsync(async (req, res) => {
    const { cycle, year, status, category, employeeId, page = 1, limit = 10 } = req.query;
    const query = {};

    if (req.user.role === 'employee') {
        const emp = await getEmployeeForUser(req.user._id);
        if (!emp) { throw new NotFoundError('Employee profile'); }
        query.owner = emp._id;
    } else if (employeeId) {
        query.owner = employeeId;
    }

    if (cycle) { query.cycle = cycle; }
    if (year) { query.year = parseInt(year); }
    if (status) { query.status = status; }
    if (category) { query.category = category; }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const [total, okrs] = await Promise.all([
        OKR.countDocuments(query),
        OKR.find(query)
            .populate('owner', 'name employeeId department position')
            .populate('parentObjective', 'title score')
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),
    ]);

    paginated(res, okrs, { total, page: pageNum, limit: limitNum });
}));

// @route   POST /api/okr
router.post('/', auth, okrCreateValidation, catchAsync(async (req, res) => {
    const { title, description, cycle, year, category, keyResults, parentObjective, employeeId } = req.body;

    let owner;
    if (req.user.role === 'employee') {
        owner = await getEmployeeForUser(req.user._id);
    } else if (employeeId) {
        owner = await Employee.findById(employeeId).lean();
    } else {
        owner = await getEmployeeForUser(req.user._id);
    }

    if (!owner) { throw new NotFoundError('Employee'); }

    if (parentObjective) {
        const parent = await OKR.findById(parentObjective);
        if (!parent) { throw new NotFoundError('Parent objective'); }
    }

    const createdBy = await getEmployeeForUser(req.user._id);

    const okr = new OKR({
        title, description,
        owner: owner._id,
        cycle, year,
        category: category || 'individual',
        keyResults,
        parentObjective: parentObjective || null,
        createdBy: createdBy?._id,
    });

    await okr.save();
    const populated = await OKR.findById(okr._id).populate('owner', 'name employeeId department').lean();
    created(res, populated, 'OKR created successfully');
}));

// ==================== KPI CRUD ====================
// IMPORTANT: /kpis routes MUST be before /:id to avoid Express routing conflict

// @route   GET /api/okr/kpis
router.get('/kpis', auth, catchAsync(async (req, res) => {
    const { category, department, status, employeeId, page = 1, limit = 10 } = req.query;
    const query = {};

    if (req.user.role === 'employee') {
        const emp = await getEmployeeForUser(req.user._id);
        if (!emp) { throw new NotFoundError('Employee profile'); }
        query.employee = emp._id;
    } else if (employeeId) {
        query.employee = employeeId;
    }

    if (category) { query.category = category; }
    if (department) { query.department = department; }
    if (status) { query.status = status; }

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

    const [total, kpis] = await Promise.all([
        KPI.countDocuments(query),
        KPI.find(query)
            .populate('employee', 'name employeeId department position')
            .sort({ createdAt: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum)
            .lean(),
    ]);

    paginated(res, kpis, { total, page: pageNum, limit: limitNum });
}));

// @route   POST /api/okr/kpis
router.post('/kpis', auth, authorize('hr', 'admin'), kpiCreateValidation, catchAsync(async (req, res) => {
    const { name, description, unit, targetValue, frequency, category, department, employeeId } = req.body;

    let employee;
    if (employeeId) {
        employee = await Employee.findById(employeeId);
        if (!employee) { throw new NotFoundError('Employee'); }
    } else {
        employee = await Employee.findOne({ userId: req.user._id });
        if (!employee) { throw new NotFoundError('Employee profile'); }
    }

    const createdBy = await getEmployeeForUser(req.user._id);

    const kpi = new KPI({
        name, description,
        employee: employee._id,
        department: department || employee.department,
        category: category || 'productivity',
        unit, targetValue,
        frequency: frequency || 'monthly',
        createdBy: createdBy?._id,
    });

    await kpi.save();
    const populated = await KPI.findById(kpi._id).populate('employee', 'name employeeId department').lean();
    created(res, populated, 'KPI created successfully');
}));

// @route   PUT /api/okr/kpis/:id
router.put('/kpis/:id', auth, authorize('hr', 'admin'), idValidation, catchAsync(async (req, res) => {
    const kpi = await KPI.findById(req.params.id);
    if (!kpi) { throw new NotFoundError('KPI'); }

    const allowedUpdates = ['name', 'description', 'unit', 'targetValue', 'frequency', 'category', 'department', 'status'];
    allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) { kpi[field] = req.body[field]; }
    });

    await kpi.save();
    const populated = await KPI.findById(kpi._id).populate('employee', 'name employeeId department').lean();
    success(res, populated, 'KPI updated successfully');
}));

// @route   POST /api/okr/kpis/:id/entries
router.post('/kpis/:id/entries', auth, kpiEntryValidation, catchAsync(async (req, res) => {
    const kpi = await KPI.findById(req.params.id);
    if (!kpi) { throw new NotFoundError('KPI'); }

    const isAdmin = ['hr', 'admin'].includes(req.user.role);
    if (!isAdmin) {
        const emp = await getEmployeeForUser(req.user._id);
        if (!emp || kpi.employee.toString() !== emp._id.toString()) {
            throw new ForbiddenError('You can only add entries to your own KPIs');
        }
    }

    kpi.entries.push({
        value: req.body.value,
        date: req.body.date || new Date(),
        notes: req.body.notes || '',
    });

    await kpi.save();
    const populated = await KPI.findById(kpi._id).populate('employee', 'name employeeId department').lean();
    success(res, populated, 'KPI entry added successfully');
}));

// @route   DELETE /api/okr/kpis/:id
router.delete('/kpis/:id', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
    const kpi = await KPI.findById(req.params.id);
    if (!kpi) { throw new NotFoundError('KPI'); }
    await KPI.findByIdAndDelete(req.params.id);
    success(res, null, 'KPI deleted successfully');
}));

// ==================== OKR SINGLE ITEM ====================
// NOTE: /:id routes MUST come after /stats and /kpis routes

// @route   GET /api/okr/:id
router.get('/:id', auth, idValidation, catchAsync(async (req, res) => {
    const okr = await OKR.findById(req.params.id)
        .populate('owner', 'name employeeId department position email')
        .populate('parentObjective', 'title score status')
        .populate('createdBy', 'name employeeId')
        .lean();

    if (!okr) { throw new NotFoundError('OKR'); }

    if (req.user.role === 'employee') {
        const emp = await getEmployeeForUser(req.user._id);
        if (!emp || okr.owner._id.toString() !== emp._id.toString()) {
            throw new ForbiddenError('You can only view your own OKRs');
        }
    }

    success(res, okr);
}));

// @route   PUT /api/okr/:id
router.put('/:id', auth, idValidation, okrUpdateValidation, catchAsync(async (req, res) => {
    const okr = await OKR.findById(req.params.id);
    if (!okr) { throw new NotFoundError('OKR'); }

    if (req.user.role === 'employee') {
        const emp = await getEmployeeForUser(req.user._id);
        if (!emp || okr.owner.toString() !== emp._id.toString()) {
            throw new ForbiddenError('You can only update your own OKRs');
        }
    }

    const allowedUpdates = ['title', 'description', 'cycle', 'year', 'category', 'status', 'keyResults', 'parentObjective'];
    allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) { okr[field] = req.body[field]; }
    });

    await okr.save();
    const populated = await OKR.findById(okr._id).populate('owner', 'name employeeId department').lean();
    success(res, populated, 'OKR updated successfully');
}));

// @route   PUT /api/okr/:id/key-results/:krIndex
router.put('/:id/key-results/:krIndex', auth, catchAsync(async (req, res) => {
    const okr = await OKR.findById(req.params.id);
    if (!okr) { throw new NotFoundError('OKR'); }

    const krIndex = parseInt(req.params.krIndex);
    if (isNaN(krIndex) || krIndex < 0 || krIndex >= okr.keyResults.length) {
        throw new BadRequestError('Invalid key result index');
    }

    if (req.user.role === 'employee') {
        const emp = await getEmployeeForUser(req.user._id);
        if (!emp || okr.owner.toString() !== emp._id.toString()) {
            throw new ForbiddenError('You can only update your own OKRs');
        }
    }

    const kr = okr.keyResults[krIndex];
    if (req.body.currentValue !== undefined) { kr.currentValue = req.body.currentValue; }
    if (req.body.title !== undefined) { kr.title = req.body.title; }
    if (req.body.targetValue !== undefined) { kr.targetValue = req.body.targetValue; }
    if (req.body.unit !== undefined) { kr.unit = req.body.unit; }
    if (req.body.weight !== undefined) { kr.weight = req.body.weight; }
    if (req.body.status !== undefined) { kr.status = req.body.status; }

    await okr.save();
    const populated = await OKR.findById(okr._id).populate('owner', 'name employeeId department').lean();
    success(res, populated, 'Key result updated successfully');
}));

// @route   DELETE /api/okr/:id
router.delete('/:id', auth, idValidation, catchAsync(async (req, res) => {
    const okr = await OKR.findById(req.params.id);
    if (!okr) { throw new NotFoundError('OKR'); }

    if (req.user.role === 'employee') {
        const emp = await getEmployeeForUser(req.user._id);
        if (!emp || okr.owner.toString() !== emp._id.toString()) {
            throw new ForbiddenError('You can only delete your own OKRs');
        }
    }

    await OKR.findByIdAndDelete(req.params.id);
    success(res, null, 'OKR deleted successfully');
}));

module.exports = router;
