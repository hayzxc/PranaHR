const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  companyName: {
    type: String,
    default: 'Sobat HR',
  },
  companyLogo: {
    type: String,
    default: '',
  },
  companyAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: { type: String, default: 'Indonesia' },
  },
  workSchedule: {
    workDays: {
      type: [String],
      default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    },
    workStartTime: {
      type: String,
      default: '09:00',
    },
    workEndTime: {
      type: String,
      default: '17:00',
    },
    breakDuration: {
      type: Number,
      default: 60, // Jam istirahat
    },
  },
  leavePolicy: {
    annualLeaveQuota: {
      type: Number,
      default: 12, // Kuota cuti tahunan
    },
    sickLeaveQuota: {
      type: Number,
      default: 12, // Kuota cuti sakit
    },
    carryOverLimit: {
      type: Number,
      default: 5,
    },
  },
  payrollSettings: {
    payDay: {
      type: Number,
      default: 25, // Tanggal gaji
    },
    currency: {
      type: String,
      default: 'IDR',
    },
    taxRate: {
      type: Number,
      default: 0, // Persen pajak
    },
  },
  holidays: [{
    name: String,
    date: Date,
    isRecurring: { type: Boolean, default: false },
  }],
  departments: {
    type: [String],
    default: ['Engineering', 'HR', 'Finance', 'Marketing', 'Operations', 'Sales', 'IT', 'Admin'],
  },
  positions: {
    type: [String],
    default: ['Manager', 'Senior', 'Junior', 'Intern', 'Director', 'Executive'],
  },
  notifications: {
    emailNotifications: { type: Boolean, default: true },
    leaveApprovalReminders: { type: Boolean, default: true },
    birthdayReminders: { type: Boolean, default: true },
    payrollReminders: { type: Boolean, default: true },
  },
}, {
  timestamps: true,
});

// Ensure only one settings document exists
settingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

module.exports = mongoose.model('Settings', settingsSchema);
