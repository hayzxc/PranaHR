const mongoose = require('mongoose');

const payrollSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  period: {
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    year: {
      type: Number,
      required: true,
    },
  },
  basicSalary: {
    type: Number,
    required: true,
  },
  earnings: {
    overtime: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    allowances: { type: Number, default: 0 },
    transport: { type: Number, default: 0 },
    meal: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },
  deductions: {
    tax: { type: Number, default: 0 },
    bpjs: { type: Number, default: 0 },
    pension: { type: Number, default: 0 },
    loan: { type: Number, default: 0 },
    absence: { type: Number, default: 0 },
    other: { type: Number, default: 0 },
  },
  grossPay: {
    type: Number,
    default: 0,
  },
  totalDeductions: {
    type: Number,
    default: 0,
  },
  netPay: {
    type: Number,
    default: 0,
  },
  workingDays: {
    expected: { type: Number, default: 22 },
    actual: { type: Number, default: 22 },
  },
  overtimeHours: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'paid', 'cancelled'],
    default: 'draft',
  },
  paymentMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'check'],
    default: 'bank_transfer',
  },
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String,
  },
  notes: {
    type: String,
    default: '',
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  paidAt: Date,
  approvedAt: Date,
}, {
  timestamps: true,
});

// Calculate totals before saving
payrollSchema.pre('save', function (next) {
  // Calculate gross pay
  const earningsTotal = Object.values(this.earnings).reduce((sum, val) => sum + (val || 0), 0);
  this.grossPay = this.basicSalary + earningsTotal;

  // Calculate total deductions
  this.totalDeductions = Object.values(this.deductions).reduce((sum, val) => sum + (val || 0), 0);

  // Calculate net pay
  this.netPay = this.grossPay - this.totalDeductions;

  next();
});

// Unique constraint for employee per period
payrollSchema.index({ employee: 1, 'period.month': 1, 'period.year': 1 }, { unique: true });
payrollSchema.index({ status: 1 });

module.exports = mongoose.model('Payroll', payrollSchema);
