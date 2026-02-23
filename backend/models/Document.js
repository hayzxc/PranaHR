const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Document title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },
  category: {
    type: String,
    required: true,
    enum: ['contract', 'id_card', 'certificate', 'resume', 'education', 'medical', 'tax', 'other'],
    default: 'other',
  },
  filename: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  filepath: {
    type: String,
    required: true,
  },
  filesize: {
    type: Number,
    required: true,
  },
  mimetype: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  expiryDate: {
    type: Date,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  verifiedAt: {
    type: Date,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, {
  timestamps: true,
});

// Indexes
documentSchema.index({ employee: 1, category: 1 });
documentSchema.index({ expiryDate: 1 });
documentSchema.index({ isVerified: 1 });

// Virtual for checking if document is expired
documentSchema.virtual('isExpired').get(function () {
  if (!this.expiryDate) {return false;}
  return new Date() > this.expiryDate;
});

// Virtual for checking if document expires soon (within 30 days)
documentSchema.virtual('expiresSoon').get(function () {
  if (!this.expiryDate) {return false;}
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return this.expiryDate <= thirtyDaysFromNow && this.expiryDate > new Date();
});

// Ensure virtuals are included in JSON
documentSchema.set('toJSON', { virtuals: true });
documentSchema.set('toObject', { virtuals: true });

// Category labels for display
documentSchema.statics.getCategoryLabels = function () {
  return {
    contract: 'Employment Contract',
    id_card: 'ID Card / KTP',
    certificate: 'Certificate',
    resume: 'Resume / CV',
    education: 'Education Document',
    medical: 'Medical Record',
    tax: 'Tax Document',
    other: 'Other',
  };
};

module.exports = mongoose.model('Document', documentSchema);
