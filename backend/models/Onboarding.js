const mongoose = require('mongoose');

const onboardingTaskSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,
  category: {
    type: String,
    enum: ['documentation', 'training', 'equipment', 'access', 'introduction', 'other'],
    default: 'other',
  },
  assignedTo: {
    type: String,
    enum: ['employee', 'hr', 'manager', 'it'],
    default: 'employee',
  },
  dueInDays: {
    type: Number,
    default: 7,
  },
  isRequired: {
    type: Boolean,
    default: true,
  },
});

const onboardingSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  expectedEndDate: {
    type: Date,
  },
  status: {
    type: String,
    enum: ['not-started', 'in-progress', 'completed', 'overdue'],
    default: 'not-started',
  },
  tasks: [{
    title: String,
    description: String,
    category: String,
    assignedTo: String,
    dueDate: Date,
    completed: { type: Boolean, default: false },
    completedAt: Date,
    completedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    notes: String,
  }],
  mentor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
  },
  documents: [{
    name: String,
    type: String,
    uploadedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ['pending', 'submitted', 'approved', 'rejected'],
      default: 'pending',
    },
  }],
  progress: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  notes: String,
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    comments: String,
    submittedAt: Date,
  },
}, {
  timestamps: true,
});

// Calculate progress before saving
onboardingSchema.pre('save', function (next) {
  if (this.tasks && this.tasks.length > 0) {
    const completedTasks = this.tasks.filter(t => t.completed).length;
    this.progress = Math.round((completedTasks / this.tasks.length) * 100);

    if (this.progress === 100) {
      this.status = 'completed';
    } else if (this.progress > 0) {
      this.status = 'in-progress';
    }
  }
  next();
});

// Index
onboardingSchema.index({ employee: 1 });
onboardingSchema.index({ status: 1 });

// Default onboarding tasks template
onboardingSchema.statics.getDefaultTasks = function () {
  return [
    { title: 'Complete personal information form', category: 'documentation', assignedTo: 'employee', dueInDays: 1, isRequired: true },
    { title: 'Submit ID documents', category: 'documentation', assignedTo: 'employee', dueInDays: 3, isRequired: true },
    { title: 'Submit bank account details', category: 'documentation', assignedTo: 'employee', dueInDays: 3, isRequired: true },
    { title: 'Sign employment contract', category: 'documentation', assignedTo: 'employee', dueInDays: 1, isRequired: true },
    { title: 'Setup workstation', category: 'equipment', assignedTo: 'it', dueInDays: 1, isRequired: true },
    { title: 'Create email account', category: 'access', assignedTo: 'it', dueInDays: 1, isRequired: true },
    { title: 'Grant system access', category: 'access', assignedTo: 'it', dueInDays: 2, isRequired: true },
    { title: 'Complete company orientation', category: 'training', assignedTo: 'hr', dueInDays: 3, isRequired: true },
    { title: 'Meet with department team', category: 'introduction', assignedTo: 'manager', dueInDays: 3, isRequired: true },
    { title: 'Review company policies', category: 'training', assignedTo: 'employee', dueInDays: 7, isRequired: true },
    { title: 'Complete safety training', category: 'training', assignedTo: 'employee', dueInDays: 7, isRequired: false },
    { title: 'Schedule 30-day check-in', category: 'other', assignedTo: 'hr', dueInDays: 30, isRequired: true },
  ];
};

module.exports = mongoose.model('Onboarding', onboardingSchema);
