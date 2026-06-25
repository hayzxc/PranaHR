/**
 * Document Routes
 * Type-safe document management with file uploads
 * PONYTAIL FIX: Prisma Integration & Hard Delete Cleanups
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const prisma = require('../lib/prisma').default;
const { auth, authorize } = require('../middleware/auth');
const { idValidation, documentValidation, DOCUMENT_CATEGORIES } = require('../middleware/validate');
const { catchAsync } = require('../middleware/errorHandler');
const { success, created, paginated } = require('../utils/response');
const { NotFoundError, ForbiddenError, BadRequestError } = require('../utils/errors');

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/documents');
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

// File filter for allowed types
const ALLOWED_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
];

const fileFilter = (req, file, cb) => {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new BadRequestError('Invalid file type. Only PDF, images, Word, Excel, and text files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

/**
 * Helper to clean up file
 */
const cleanupFile = (filepath) => {
  try {
    if (filepath && fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  } catch (err) {
    console.error('Error cleaning up file:', err);
  }
};

// @route   GET /api/documents/stats
// @desc    Get document statistics
// @access  Private (Admin, HR)
router.get('/stats', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  const now = new Date();

  const [documents, expiringCount, expiredCount] = await Promise.all([
    prisma.document.findMany({ include: { owner: { select: { name: true, department: true } } } }),
    prisma.document.count({ where: { expiryDate: { lte: thirtyDaysFromNow, gte: now } } }),
    prisma.document.count({ where: { expiryDate: { lt: now } } })
  ]);

  const categoryStatsObj = {};
  let verifiedCount = 0;
  let unverifiedCount = 0;

  documents.forEach(d => {
    categoryStatsObj[d.category] = (categoryStatsObj[d.category] || 0) + 1;
    if (d.isVerified) verifiedCount++;
    else unverifiedCount++;
  });

  const categoryStats = Object.entries(categoryStatsObj)
    .map(([id, count]) => ({ _id: id, count }))
    .sort((a, b) => b.count - a.count);

  const recentUploads = documents.sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);

  success(res, {
    total: documents.length,
    byCategory: categoryStats,
    verified: verifiedCount,
    unverified: unverifiedCount,
    expiringSoon: expiringCount,
    expired: expiredCount,
    recentUploads,
  });
}));

// @route   GET /api/documents/expiring
// @desc    Get documents expiring soon
// @access  Private (Admin, HR)
router.get('/expiring', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const days = Math.min(90, Math.max(1, parseInt(req.query.days) || 30));
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  const documents = await prisma.document.findMany({
    where: { expiryDate: { lte: futureDate, gte: new Date() } },
    include: { owner: { select: { name: true, employeeId: true, department: true, email: true } } },
    orderBy: { expiryDate: 'asc' }
  });

  const sevenDays = new Date();
  sevenDays.setDate(sevenDays.getDate() + 7);

  const critical = documents.filter(d => d.expiryDate <= sevenDays);
  const warning = documents.filter(d => d.expiryDate > sevenDays);

  success(res, {
    documents,
    summary: {
      total: documents.length,
      critical: critical.length,
      warning: warning.length,
    },
  });
}));

// @route   GET /api/documents/my-documents
// @desc    Get employee's own documents
// @access  Private
router.get('/my-documents', auth, catchAsync(async (req, res) => {
  const employee = await prisma.employee.findUnique({ where: { userId: req.user.id } });

  if (!employee) throw new NotFoundError('Employee profile');

  const { category, verified } = req.query;
  const where = { ownerId: employee.id };

  if (category && DOCUMENT_CATEGORIES.includes(category)) where.category = category;
  if (verified !== undefined) where.isVerified = verified === 'true';

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' }
  });

  const summary = {
    total: documents.length,
    verified: documents.filter(d => d.isVerified).length,
    expiringSoon: documents.filter(d => {
      if (!d.expiryDate) return false;
      const daysUntilExpiry = Math.ceil((new Date(d.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
      return daysUntilExpiry > 0 && daysUntilExpiry <= 30;
    }).length,
  };

  success(res, { documents, summary });
}));

// @route   GET /api/documents/categories
// @desc    Get list of document categories
// @access  Private
router.get('/categories', auth, catchAsync(async (req, res) => {
  success(res, DOCUMENT_CATEGORIES);
}));

// @route   GET /api/documents
// @desc    Get all documents
// @access  Private (Admin, HR)
router.get('/', auth, authorize('admin', 'hr'), catchAsync(async (req, res) => {
  const { category, employee, verified, expiring, search, page = 1, limit = 20 } = req.query;
  const where = {};

  if (category && DOCUMENT_CATEGORIES.includes(category)) where.category = category;
  if (employee) where.ownerId = employee;
  if (verified !== undefined) where.isVerified = verified === 'true';

  if (expiring === 'true') {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    where.expiryDate = { lte: thirtyDaysFromNow, gte: new Date() };
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  let [total, documents] = await Promise.all([
    prisma.document.count({ where }),
    prisma.document.findMany({
      where,
      include: { owner: { select: { name: true, employeeId: true, department: true, position: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    })
  ]);

  if (search) {
    const searchLower = search.toLowerCase();
    documents = documents.filter(doc =>
      doc.title?.toLowerCase().includes(searchLower) ||
      doc.owner?.name?.toLowerCase().includes(searchLower) ||
      doc.owner?.employeeId?.toLowerCase().includes(searchLower) ||
      doc.category?.toLowerCase().includes(searchLower)
    );
    total = documents.length; // Approximate adjustment
  }

  paginated(res, documents, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/documents/:id
// @desc    Get single document
// @access  Private
router.get('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const document = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { owner: { select: { userId: true, name: true, employeeId: true, department: true, position: true } } }
  });

  if (!document) throw new NotFoundError('Document');

  if (req.user.role === 'employee') {
    if (!document.owner || document.owner.userId !== req.user.id) {
      throw new ForbiddenError('You can only view your own documents');
    }
  }

  success(res, document);
}));

// @route   GET /api/documents/:id/download
// @desc    Download document file
// @access  Private
router.get('/:id/download', auth, idValidation, catchAsync(async (req, res) => {
  const document = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { owner: { select: { userId: true } } }
  });

  if (!document) throw new NotFoundError('Document');

  if (req.user.role === 'employee') {
    if (!document.owner || document.owner.userId !== req.user.id) {
      throw new ForbiddenError('You can only download your own documents');
    }
  }

  const filePath = path.join(__dirname, '..', document.fileUrl);

  if (!fs.existsSync(filePath)) {
    throw new NotFoundError('File not found on server');
  }

  res.download(filePath, document.fileName);
}));

// @route   POST /api/documents/upload
// @desc    Upload document
// @access  Private
router.post('/upload', auth, upload.single('file'), catchAsync(async (req, res) => {
  if (!req.file) throw new BadRequestError('No file uploaded');

  const { employeeId, title, category, description, expiryDate } = req.body;

  if (!employeeId || !title) {
    cleanupFile(req.file.path);
    throw new BadRequestError('Employee ID and title are required');
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) {
    cleanupFile(req.file.path);
    throw new NotFoundError('Employee');
  }

  if (req.user.role === 'employee') {
    if (employee.userId !== req.user.id) {
      cleanupFile(req.file.path);
      throw new ForbiddenError('You can only upload documents for yourself');
    }
  }

  const validCategory = category && DOCUMENT_CATEGORIES.includes(category) ? category : 'other';

  const document = await prisma.document.create({
    data: {
      ownerId: employee.id,
      title,
      category: validCategory,
      fileName: req.file.originalname,
      fileUrl: `uploads/documents/${req.file.filename}`,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      description: description || null,
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      hasExpiry: !!expiryDate,
      isVerified: false
    },
    include: { owner: { select: { name: true, employeeId: true, department: true } } }
  });

  created(res, document, 'Document uploaded successfully');
}));

// @route   PUT /api/documents/:id
// @desc    Update document metadata
// @access  Private
router.put('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const document = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { owner: { select: { userId: true } } }
  });

  if (!document) throw new NotFoundError('Document');

  if (req.user.role === 'employee') {
    if (!document.owner || document.owner.userId !== req.user.id) {
      throw new ForbiddenError('You can only update your own documents');
    }
  }

  const data = {};
  if (req.body.title !== undefined) data.title = req.body.title;
  if (req.body.description !== undefined) data.description = req.body.description;
  if (req.body.category && DOCUMENT_CATEGORIES.includes(req.body.category)) data.category = req.body.category;
  if (req.body.expiryDate !== undefined) {
    data.expiryDate = req.body.expiryDate ? new Date(req.body.expiryDate) : null;
    data.hasExpiry = !!req.body.expiryDate;
  }

  const updatedDocument = await prisma.document.update({
    where: { id: req.params.id },
    data,
    include: { owner: { select: { name: true, employeeId: true, department: true } } }
  });

  success(res, updatedDocument, 'Document updated successfully');
}));

// @route   PUT /api/documents/:id/verify
// @desc    Verify document
// @access  Private (Admin, HR)
router.put('/:id/verify', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: req.params.id } });

  if (!document) throw new NotFoundError('Document');
  if (document.isVerified) throw new BadRequestError('Document is already verified');

  const updatedDocument = await prisma.document.update({
    where: { id: req.params.id },
    data: { isVerified: true },
    include: { owner: { select: { name: true, employeeId: true, department: true } } }
  });

  success(res, updatedDocument, 'Document verified successfully');
}));

// @route   PUT /api/documents/:id/unverify
// @desc    Unverify document
// @access  Private (Admin, HR)
router.put('/:id/unverify', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: req.params.id } });

  if (!document) throw new NotFoundError('Document');
  if (!document.isVerified) throw new BadRequestError('Document is not verified');

  const updatedDocument = await prisma.document.update({
    where: { id: req.params.id },
    data: { isVerified: false },
    include: { owner: { select: { name: true, employeeId: true, department: true } } }
  });

  success(res, updatedDocument, 'Document verification removed');
}));

// @route   DELETE /api/documents/:id
// @desc    Delete document permanently
// @access  Private
router.delete('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const document = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { owner: { select: { userId: true } } }
  });

  if (!document) throw new NotFoundError('Document');

  if (req.user.role === 'employee') {
    if (!document.owner || document.owner.userId !== req.user.id) {
      throw new ForbiddenError('You can only delete your own documents');
    }
  }

  // Delete file from disk
  const filePath = path.join(__dirname, '..', document.fileUrl);
  cleanupFile(filePath);

  await prisma.document.delete({ where: { id: req.params.id } });

  success(res, null, 'Document deleted successfully');
}));

module.exports = router;
