const mongoose = require('mongoose');

const watchProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  videoId: {
    type: String,
    required: true
  },
  positionSeconds: {
    type: Number,
    required: true,
    default: 0
  }
}, { timestamps: true });

watchProgressSchema.index({ userId: 1, videoId: 1 }, { unique: true });

module.exports = mongoose.model('WatchProgress', watchProgressSchema);
