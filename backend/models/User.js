/**
 * User Model
 * Authentication and user management
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email'],
    index: true,
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false, // Don't include password by default
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'hr', 'employee'],
      message: '{VALUE} is not a valid role',
    },
    default: 'employee',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  lastLogin: {
    type: Date,
    default: null,
  },
  passwordChangedAt: {
    type: Date,
    default: null,
  },
  passwordResetToken: {
    type: String,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
  },
  tokenVersion: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
  toJSON: {
    transform: function (doc, ret) {
      delete ret.password;
      delete ret.passwordResetToken;
      delete ret.passwordResetExpires;
      delete ret.__v;
      return ret;
    },
  },
});

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });
userSchema.index({ createdAt: -1 });

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash if password is modified
  if (!this.isModified('password')) {return next();}

  // Hash password with cost of 12
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);

  // Set passwordChangedAt
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000; // Subtract 1 second for token timing
  }

  next();
});

/**
 * Compare password method
 * @param {string} candidatePassword - Password to compare
 * @returns {Promise<boolean>} True if password matches
 */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Check if password was changed after token was issued
 * @param {number} JWTTimestamp - JWT issued at timestamp
 * @returns {boolean} True if password was changed after token
 */
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  return false;
};

/**
 * Override toJSON to remove sensitive fields
 */
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  delete user.__v;
  return user;
};

/**
 * Static method to find user by email with password
 * @param {string} email - User email
 * @returns {Promise<User>} User with password field
 */
userSchema.statics.findByCredentials = async function (email) {
  return this.findOne({ email: email.toLowerCase() }).select('+password');
};

module.exports = mongoose.model('User', userSchema);
