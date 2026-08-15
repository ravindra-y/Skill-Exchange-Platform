const express = require('express');
const { protect } = require('../middleware/auth');
const Room = require('../models/Room');
const ExchangeRequest = require('../models/ExchangeRequest');

const router = express.Router();

// @route   GET /api/rooms/:roomId
// @desc    Get a room by its ID — only the two participants can access it
// @access  Private
router.get('/:roomId', protect, async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId)
      .populate({
        path: 'exchangeRequestId',
        populate: [
          { path: 'senderId',   select: 'name username' },
          { path: 'receiverId', select: 'name username' },
        ],
      });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    const exReq    = room.exchangeRequestId;
    const senderId = exReq.senderId._id.toString();
    const recvId   = exReq.receiverId._id.toString();
    const myId     = req.user._id.toString();

    if (myId !== senderId && myId !== recvId) {
      return res.status(403).json({ message: 'Forbidden: you are not a participant in this room' });
    }

    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// @route   GET /api/rooms/by-exchange/:exchangeId
// @desc    Find a room by the exchange request ID
// @access  Private
router.get('/by-exchange/:exchangeId', protect, async (req, res) => {
  try {
    const exReq = await ExchangeRequest.findById(req.params.exchangeId);
    if (!exReq) return res.status(404).json({ message: 'Exchange request not found' });

    const myId = req.user._id.toString();
    if (myId !== exReq.senderId.toString() && myId !== exReq.receiverId.toString()) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const room = await Room.findOne({ exchangeRequestId: req.params.exchangeId });
    if (!room) return res.status(404).json({ message: 'Room not created yet' });

    res.json(room);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
