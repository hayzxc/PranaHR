/**
 * Counter Model
 * Atomic counter for generating sequential IDs (e.g. employeeId)
 * Uses MongoDB's findOneAndUpdate with $inc for race-condition-safe increments.
 */

const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

/**
 * Get the next sequence value for a given counter name.
 * Creates the counter document if it doesn't exist.
 * @param {string} name - Counter identifier (e.g. 'employeeId')
 * @returns {Promise<number>} The next sequence number
 */
counterSchema.statics.getNextSequence = async function (name) {
  const counter = await this.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  );
  return counter.seq;
};

module.exports = mongoose.model('Counter', counterSchema);
