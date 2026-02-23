/**
 * Document Routes
 * Type-safe document management with file uploads
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Document = require('../models/Document');
const Employee = require('../models/Employee');
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
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

/**
 * Helper to clean up file on error
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

  const [categoryStats, verificationStats, expiringCount, expiredCount, totalCount, recentUploads] = await Promise.all([
    Document.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Document.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: '$isVerified', count: { $sum: 1 } } },
    ]),
    Document.countDocuments({
      isActive: true,
      expiryDate: { $lte: thirtyDaysFromNow, $gte: new Date() },
    }),
    Document.countDocuments({
      isActive: true,
      expiryDate: { $lt: new Date() },
    }),
    Document.countDocuments({ isActive: true }),
    Document.find({ isActive: true })
      .populate('employee', 'name department')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  success(res, {
    total: totalCount,
    byCategory: categoryStats,
    verified: verificationStats.find(v => v._id === true)?.count || 0,
    unverified: verificationStats.find(v => v._id === false)?.count || 0,
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

  const documents = await Document.find({
    isActive: true,
    expiryDate: { $lte: futureDate, $gte: new Date() },
  })
    .populate('employee', 'name employeeId department email')
    .sort({ expiryDate: 1 })
    .lean();

  // Group by urgency
  const sevenDays = new Date();
  sevenDays.setDate(sevenDays.getDate() + 7);

  const critical = documents.filter(d => new Date(d.expiryDate) <= sevenDays);
  const warning = documents.filter(d => new Date(d.expiryDate) > sevenDays);

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
  const employee = await Employee.findOne({ userId: req.user._id });

  if (!employee) {
    throw new NotFoundError('Employee profile');
  }

  const { category, verified } = req.query;
  const query = {
    employee: employee._id,
    isActive: true,
  };

  if (category && DOCUMENT_CATEGORIES.includes(category)) {
    query.category = category;
  }
  if (verified !== undefined) {
    query.isVerified = verified === 'true';
  }

  const documents = await Document.find(query)
    .sort({ createdAt: -1 })
    .lean();

  // Add summary
  const summary = {
    total: documents.length,
    verified: documents.filter(d => d.isVerified).length,
    expiringSoon: documents.filter(d => {
      if (!d.expiryDate) {return false;}
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
  const query = { isActive: true };

  if (category && DOCUMENT_CATEGORIES.includes(category)) {
    query.category = category;
  }
  if (employee) {query.employee = employee;}
  if (verified !== undefined) {query.isVerified = verified === 'true';}

  // Filter for expiring documents (within 30 days)
  if (expiring === 'true') {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    query.expiryDate = { $lte: thirtyDaysFromNow, $gte: new Date() };
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

  let [total, documents] = await Promise.all([
    Document.countDocuments(query),
    Document.find(query)
      .populate('employee', 'name employeeId department position')
      .populate('uploadedBy', 'email')
      .populate('verifiedBy', 'email')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
  ]);

  // Search filter (post-query for text search)
  if (search) {
    const searchLower = search.toLowerCase();
    documents = documents.filter(doc =>
      doc.title?.toLowerCase().includes(searchLower) ||
            doc.employee?.name?.toLowerCase().includes(searchLower) ||
            doc.employee?.employeeId?.toLowerCase().includes(searchLower) ||
            doc.category?.toLowerCase().includes(searchLower),
    );
  }

  paginated(res, documents, { total, page: pageNum, limit: limitNum });
}));

// @route   GET /api/documents/:id
// @desc    Get single document
// @access  Private
router.get('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const document = await Document.findById(req.params.id)
    .populate('employee', 'name employeeId department position userId')
    .populate('uploadedBy', 'email')
    .populate('verifiedBy', 'email')
    .lean();

  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check access for employees
  if (req.user.role === 'employee') {
    if (document.employee.userId.toString() !== req.user._id.toString()) {
      throw new ForbiddenError('You can only view your own documents');
    }
  }

  success(res, document);
}));

// @route   GET /api/documents/:id/download
// @desc    Download document file
// @access  Private
router.get('/:id/download', auth, idValidation, catchAsync(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check access for employees
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee || document.employee.toString() !== employee._id.toString()) {
      throw new ForbiddenError('You can only download your own documents');
    }
  }

  const filePath = path.join(__dirname, '..', document.filepath);

  if (!fs.existsSync(filePath)) {
    throw new NotFoundError('File not found on server');
  }

  // Log download
  document.downloadCount = (document.downloadCount || 0) + 1;
  document.lastDownloadedAt = new Date();
  await document.save();

  res.download(filePath, document.originalName);
}));

// @route   POST /api/documents/upload
// @desc    Upload document
// @access  Private
router.post('/upload', auth, upload.single('file'), catchAsync(async (req, res) => {
  if (!req.file) {
    throw new BadRequestError('No file uploaded');
  }

  const { employeeId, title, category, description, expiryDate } = req.body;

  if (!employeeId || !title) {
    cleanupFile(req.file.path);
    throw new BadRequestError('Employee ID and title are required');
  }

  // Validate employee exists
  const employee = await Employee.findById(employeeId);
  if (!employee) {
    cleanupFile(req.file.path);
    throw new NotFoundError('Employee');
  }

  // Check permission for employee role
  if (req.user.role === 'employee') {
    const userEmployee = await Employee.findOne({ userId: req.user._id });
    if (!userEmployee || userEmployee._id.toString() !== employeeId) {
      cleanupFile(req.file.path);
      throw new ForbiddenError('You can only upload documents for yourself');
    }
  }

  // Validate category
  const validCategory = category && DOCUMENT_CATEGORIES.includes(category) ? category : 'other';

  const document = new Document({
    employee: employeeId,
    title,
    category: validCategory,
    filename: req.file.filename,
    originalName: req.file.originalname,
    filepath: `uploads/documents/${req.file.filename}`,
    filesize: req.file.size,
    mimetype: req.file.mimetype,
    description,
    expiryDate: expiryDate || null,
    uploadedBy: req.user._id,
  });

  await document.save();

  const populatedDocument = await Document.findById(document._id)
    .populate('employee', 'name employeeId department')
    .lean();

  created(res, populatedDocument, 'Document uploaded successfully');
}));

// @route   PUT /api/documents/:id
// @desc    Update document metadata
// @access  Private
router.put('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check permission for employee role
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee || document.employee.toString() !== employee._id.toString()) {
      throw new ForbiddenError('You can only update your own documents');
    }
  }

  const allowedUpdates = ['title', 'category', 'description', 'expiryDate'];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      if (field === 'category' && !DOCUMENT_CATEGORIES.includes(req.body[field])) {
        return; // Skip invalid category
      }
      document[field] = req.body[field];
    }
  });

  await document.save();

  const populatedDocument = await Document.findById(document._id)
    .populate('employee', 'name employeeId department')
    .lean();

  success(res, populatedDocument, 'Document updated successfully');
}));

// @route   PUT /api/documents/:id/verify
// @desc    Verify document
// @access  Private (Admin, HR)
router.put('/:id/verify', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    throw new NotFoundError('Document');
  }

  if (document.isVerified) {
    throw new BadRequestError('Document is already verified');
  }

  document.isVerified = true;
  document.verifiedBy = req.user._id;
  document.verifiedAt = new Date();
  document.verificationNotes = req.body.notes || null;

  await document.save();

  const populatedDocument = await Document.findById(document._id)
    .populate('employee', 'name employeeId department')
    .populate('verifiedBy', 'email')
    .lean();

  success(res, populatedDocument, 'Document verified successfully');
}));

// @route   PUT /api/documents/:id/unverify
// @desc    Unverify document
// @access  Private (Admin, HR)
router.put('/:id/unverify', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    throw new NotFoundError('Document');
  }

  if (!document.isVerified) {
    throw new BadRequestError('Document is not verified');
  }

  document.isVerified = false;
  document.verifiedBy = null;
  document.verifiedAt = null;
  document.verificationNotes = req.body.reason || null;

  await document.save();

  success(res, document, 'Document verification removed');
}));

// @route   DELETE /api/documents/:id
// @desc    Delete document (soft delete)
// @access  Private
router.delete('/:id', auth, idValidation, catchAsync(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    throw new NotFoundError('Document');
  }

  // Check permission
  if (req.user.role === 'employee') {
    const employee = await Employee.findOne({ userId: req.user._id });
    if (!employee || document.employee.toString() !== employee._id.toString()) {
      throw new ForbiddenError('You can only delete your own documents');
    }
  }

  // Soft delete
  document.isActive = false;
  document.deletedAt = new Date();
  document.deletedBy = req.user._id;
  await document.save();

  success(res, null, 'Document deleted successfully');
}));

// @route   DELETE /api/documents/:id/permanent
// @desc    Permanently delete document
// @access  Private (Admin)
router.delete('/:id/permanent', auth, authorize('admin'), idValidation, catchAsync(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    throw new NotFoundError('Document');
  }

  // Delete file from disk
  const filePath = path.join(__dirname, '..', document.filepath);
  cleanupFile(filePath);

  await Document.findByIdAndDelete(req.params.id);

  success(res, null, 'Document permanently deleted');
}));

// @route   POST /api/documents/:id/restore
// @desc    Restore soft-deleted document
// @access  Private (Admin, HR)
router.post('/:id/restore', auth, authorize('admin', 'hr'), idValidation, catchAsync(async (req, res) => {
  const document = await Document.findById(req.params.id);

  if (!document) {
    throw new NotFoundError('Document');
  }

  if (document.isActive) {
    throw new BadRequestError('Document is not deleted');
  }

  document.isActive = true;
  document.deletedAt = null;
  document.deletedBy = null;
  await document.save();

  success(res, document, 'Document restored successfully');
}));

module.exports = router;
