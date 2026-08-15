const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  exchangeRequestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ExchangeRequest',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active',
  },
  startedAt: {
    type: Date,
    default: Date.now,
  },
  endedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

const Room = mongoose.model('Room', roomSchema);

module.exports = Room;
