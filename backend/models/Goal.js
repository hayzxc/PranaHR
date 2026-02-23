const mongoose = require('mongoose');

const goalSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  title: {
    type: String,
    required: [true, 'Goal title is required'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    enum: ['Performance', 'Development', 'Project', 'Personal', 'Team'],
    default: 'Performance',
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  startDate: {
    type: Date,
    default: Date.now,
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required'],
  },
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed', 'cancelled', 'overdue'],
    default: 'not-started',
  },
  keyResults: [{
    title: String,
    target: Number,
    current: { type: Number, default: 0 },
    unit: String,
  }],
  milestones: [{
    title: String,
    dueDate: Date,
    completed: { type: Boolean, default: false },
    completedAt: Date,
  }],
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
  },
  comments: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Employee',
    },
    text: String,
    createdAt: { type: Date, default: Date.now },
  }],
}, {
  timestamps: true,
});

// Auto-update status based on progress and due date
goalSchema.pre('save', function (next) {
  if (this.progress >= 100) {
    this.status = 'completed';
  } else if (this.progress > 0 && this.status === 'not-started') {
    this.status = 'in-progress';
  } else if (new Date() > this.dueDate && this.status !== 'completed' && this.status !== 'cancelled') {
    this.status = 'overdue';
  }
  next();
});

// Index for queries
goalSchema.index({ employee: 1, status: 1 });
goalSchema.index({ dueDate: 1 });

module.exports = mongoose.model('Goal', goalSchema);
