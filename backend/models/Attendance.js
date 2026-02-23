const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  date: {
    type: Date,
    required: true,
    default: () => new Date().setHours(0, 0, 0, 0),
  },
  clockIn: {
    type: Date,
  },
  clockOut: {
    type: Date,
  },
  hoursWorked: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'late', 'half-day', 'on-leave'],
    default: 'present',
  },
  notes: {
    type: String,
    trim: true,
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
  },
  ipAddress: {
    type: String,
  },
}, {
  timestamps: true,
});

// Calculate hours worked before saving
attendanceSchema.pre('save', function (next) {
  if (this.clockIn && this.clockOut) {
    const diffMs = this.clockOut - this.clockIn;
    this.hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
  }

  // Determine if late (assuming 9 AM start)
  if (this.clockIn) {
    const clockInHour = new Date(this.clockIn).getHours();
    const clockInMinute = new Date(this.clockIn).getMinutes();
    if (clockInHour > 9 || (clockInHour === 9 && clockInMinute > 15)) {
      this.status = 'late';
    }
  }

  next();
});

// Compound index for unique attendance per employee per day
attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: -1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
