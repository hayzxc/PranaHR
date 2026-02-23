const mongoose = require('mongoose');

const employeeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  employeeId: {
    type: String,
    unique: true,
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  phone: {
    type: String,
    trim: true,
  },
  department: {
    type: String,
    required: [true, 'Department is required'],
    enum: ['Sertifikasi', 'Finance', 'Admin/CS', 'Verifikasi', 'Teknis dan IT'],
  },
  position: {
    type: String,
    required: [true, 'Position is required'],
    trim: true,
  },
  salary: {
    type: Number,
    required: [true, 'Salary is required'],
    min: 0,
  },
  hireDate: {
    type: Date,
    default: Date.now,
  },
  dateOfBirth: {
    type: Date,
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'Indonesia' },
  },
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'on-leave', 'terminated'],
    default: 'active',
  },
  avatar: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

// Generate employee ID before saving
employeeSchema.pre('save', async function (next) {
  if (!this.employeeId) {
    const count = await mongoose.model('Employee').countDocuments();
    this.employeeId = `EMP${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Index for faster queries
employeeSchema.index({ department: 1, status: 1 });

module.exports = mongoose.model('Employee', employeeSchema);
