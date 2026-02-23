const mongoose = require('mongoose');

const candidateSchema = new mongoose.Schema({
  job: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Job',
    required: true,
  },
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  resumeUrl: {
    type: String,
  },
  coverLetter: {
    type: String,
  },
  linkedIn: String,
  portfolio: String,
  experience: {
    years: Number,
    summary: String,
  },
  education: {
    degree: String,
    institution: String,
    graduationYear: Number,
  },
  skills: [{
    type: String,
  }],
  currentSalary: Number,
  expectedSalary: Number,
  noticePeriod: {
    type: String,
    enum: ['immediate', '1-week', '2-weeks', '1-month', '2-months', '3-months'],
    default: '1-month',
  },
  source: {
    type: String,
    enum: ['website', 'linkedin', 'referral', 'job-board', 'recruitment-agency', 'other'],
    default: 'website',
  },
  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
  },
  stage: {
    type: String,
    enum: ['applied', 'screening', 'interview', 'assessment', 'offer', 'hired', 'rejected', 'withdrawn'],
    default: 'applied',
  },
  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
  interviews: [{
    type: {
      type: String,
      enum: ['phone', 'video', 'in-person', 'technical', 'hr', 'final'],
    },
    scheduledAt: Date,
    interviewers: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    }],
    feedback: String,
    rating: { type: Number, min: 1, max: 5 },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled', 'no-show'],
      default: 'scheduled',
    },
  }],
  assessments: [{
    name: String,
    score: Number,
    maxScore: Number,
    completedAt: Date,
    notes: String,
  }],
  notes: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    text: String,
    createdAt: { type: Date, default: Date.now },
  }],
  offer: {
    salary: Number,
    startDate: Date,
    expiryDate: Date,
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'negotiating'],
      default: 'pending',
    },
    notes: String,
  },
  rejectionReason: String,
  hiredAt: Date,
}, {
  timestamps: true,
});

// Virtual for full name
candidateSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Index
candidateSchema.index({ job: 1, stage: 1 });
candidateSchema.index({ email: 1, job: 1 });
candidateSchema.index({ '$**': 'text' });

module.exports = mongoose.model('Candidate', candidateSchema);
