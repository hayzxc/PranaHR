const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Job title is required'],
    trim: true,
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
  },
  location: {
    type: String,
    default: 'On-site',
  },
  type: {
    type: String,
    enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'],
    default: 'full-time',
  },
  level: {
    type: String,
    enum: ['entry', 'junior', 'mid', 'senior', 'lead', 'manager', 'director', 'executive'],
    default: 'mid',
  },
  description: {
    type: String,
    required: true,
  },
  requirements: [{
    type: String,
  }],
  responsibilities: [{
    type: String,
  }],
  skills: [{
    type: String,
  }],
  salary: {
    min: Number,
    max: Number,
    currency: { type: String, default: 'IDR' },
    isNegotiable: { type: Boolean, default: true },
    isVisible: { type: Boolean, default: false },
  },
  benefits: [{
    type: String,
  }],
  openings: {
    type: Number,
    default: 1,
    min: 1,
  },
  status: {
    type: String,
    enum: ['draft', 'open', 'paused', 'closed', 'filled'],
    default: 'draft',
  },
  publishedAt: Date,
  closingDate: Date,
  hiringManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  applicantCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
});

// Index
jobSchema.index({ status: 1, department: 1 });
jobSchema.index({ title: 'text', description: 'text' });

module.exports = mongoose.model('Job', jobSchema);
