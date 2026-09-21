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
    enum: ['pending', 'accepted', 'rejected', 'cancelled', 'completed'],
    default: 'pending',
  },
  requestedSkillId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
  },
  offeredSkillId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
  },
  proposedDate: {
    type: Date,
  },
  message: {
    type: String,
  },
  sharedLinks: [{
    url: String,
    title: String,
  }],
  agendaItems: [{
    text: String,
    isCompleted: {
      type: Boolean,
      default: false
    }
  }],
}, {
  timestamps: true,
});

const ExchangeRequest = mongoose.model('ExchangeRequest', exchangeRequestSchema);

module.exports = ExchangeRequest;
