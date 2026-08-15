const mongoose = require('mongoose');

const exchangeRequestSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'cancelled'],
    default: 'pending',
  },
  requestedSkillId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
  },
}, {
  timestamps: true,
});

const ExchangeRequest = mongoose.model('ExchangeRequest', exchangeRequestSchema);

module.exports = ExchangeRequest;
