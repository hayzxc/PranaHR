const mongoose = require('mongoose');

const performanceReviewSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  reviewPeriod: {
    type: String,
    required: true,
    enum: ['Q1', 'Q2', 'Q3', 'Q4', 'Annual', 'Probation', 'Mid-Year'],
  },
  year: {
    type: Number,
    required: true,
  },
  ratings: {
    productivity: {
      score: { type: Number, min: 1, max: 5 },
      comments: String,
    },
    quality: {
      score: { type: Number, min: 1, max: 5 },
      comments: String,
    },
    teamwork: {
      score: { type: Number, min: 1, max: 5 },
      comments: String,
    },
    communication: {
      score: { type: Number, min: 1, max: 5 },
      comments: String,
    },
    initiative: {
      score: { type: Number, min: 1, max: 5 },
      comments: String,
    },
    attendance: {
      score: { type: Number, min: 1, max: 5 },
      comments: String,
    },
  },
  overallRating: {
    type: Number,
    min: 1,
    max: 5,
  },
  strengths: {
    type: String,
    default: '',
  },
  areasForImprovement: {
    type: String,
    default: '',
  },
  goals: {
    type: String,
    default: '',
  },
  employeeFeedback: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'acknowledged', 'completed'],
    default: 'draft',
  },
  submittedAt: Date,
  acknowledgedAt: Date,
}, {
  timestamps: true,
});

// Calculate overall rating before saving
performanceReviewSchema.pre('save', function (next) {
  const ratings = this.ratings;
  const scores = [
    ratings.productivity?.score,
    ratings.quality?.score,
    ratings.teamwork?.score,
    ratings.communication?.score,
    ratings.initiative?.score,
    ratings.attendance?.score,
  ].filter(s => s != null);

  if (scores.length > 0) {
    this.overallRating = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
  }
  next();
});

// Index for queries
performanceReviewSchema.index({ employee: 1, year: 1, reviewPeriod: 1 });
performanceReviewSchema.index({ reviewer: 1 });

module.exports = mongoose.model('PerformanceReview', performanceReviewSchema);
