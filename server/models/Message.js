const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    exchangeRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExchangeRequest',
      required: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Fast history loading: messages for a conversation ordered by time
messageSchema.index({ exchangeRequestId: 1, createdAt: 1 });

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
