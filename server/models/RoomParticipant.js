const mongoose = require('mongoose');

const roomParticipantSchema = new mongoose.Schema({
  roomId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  leftAt: {
    type: Date,
  },
});

const RoomParticipant = mongoose.model('RoomParticipant', roomParticipantSchema);

module.exports = RoomParticipant;
