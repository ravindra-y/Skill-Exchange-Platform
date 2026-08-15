const express = require('express');
const { protect } = require('../middleware/auth');
const ExchangeRequest = require('../models/ExchangeRequest');
const Room = require('../models/Room');

const router = express.Router();

// @route   POST /api/exchange
// @desc    Send an exchange request
// @access  Private
router.post('/', protect, async (req, res) => {
  const { receiverId } = req.body; // Can also send requestedSkillId if we want

  if (receiverId === req.user._id.toString()) {
    return res.status(400).json({ message: 'Cannot send request to yourself' });
  }

  try {
    // Check if pending request already exists
    const existing = await ExchangeRequest.findOne({
      senderId: req.user._id,
      receiverId,
      status: 'pending'
    });

    if (existing) {
      return res.status(400).json({ message: 'Pending request already exists' });
    }

    const exchangeReq = await ExchangeRequest.create({
      senderId: req.user._id,
      receiverId
    });

    res.status(201).json(exchangeReq);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/exchange
// @desc    Get sent and received requests for current user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const sent = await ExchangeRequest.find({ senderId: req.user._id })
      .populate('receiverId', 'name username avatarUrl')
      .sort({ createdAt: -1 });

    const received = await ExchangeRequest.find({ receiverId: req.user._id })
      .populate('senderId', 'name username avatarUrl')
      .sort({ createdAt: -1 });

    res.json({ sent, received });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/exchange/:id/status
// @desc    Update request status (accept, reject, cancel)
// @access  Private
router.put('/:id/status', protect, async (req, res) => {
  const { status } = req.body; // 'accepted', 'rejected', 'cancelled'

  if (!['accepted', 'rejected', 'cancelled'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const request = await ExchangeRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Authorization checks
    if (status === 'cancelled') {
      // Only sender can cancel, and only if pending
      if (request.senderId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to cancel' });
      }
      if (request.status !== 'pending') {
        return res.status(400).json({ message: 'Can only cancel pending requests' });
      }
    } else {
      // accept / reject: Only receiver can do this, and only if pending
      if (request.receiverId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to accept/reject' });
      }
      if (request.status !== 'pending') {
        return res.status(400).json({ message: 'Can only accept/reject pending requests' });
      }
    }

    request.status = status;
    await request.save();

    // If accepted, create a Room
    if (status === 'accepted') {
      await Room.create({
        exchangeRequestId: request._id,
        status: 'active'
      });
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
