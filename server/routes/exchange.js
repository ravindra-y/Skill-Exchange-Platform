const express = require('express');
const { protect } = require('../middleware/auth');
const ExchangeRequest = require('../models/ExchangeRequest');
const Room = require('../models/Room');

const router = express.Router();

// @route   POST /api/exchange
// @desc    Send an exchange request
// @access  Private
router.post('/', protect, async (req, res) => {
  const { receiverId, requestedSkillId, offeredSkillId, proposedDate, message } = req.body; 

  if (receiverId === req.user._id.toString()) {
    return res.status(400).json({ message: 'Cannot send request to yourself' });
  }

  try {
    // Check if pending or accepted request already exists between these users
    const existing = await ExchangeRequest.findOne({
      $or: [
        { senderId: req.user._id, receiverId },
        { senderId: receiverId, receiverId: req.user._id }
      ],
      status: { $in: ['pending', 'accepted'] }
    });

    if (existing) {
      return res.status(400).json({ message: 'A pending or accepted request already exists between you two.' });
    }

    const exchangeReq = await ExchangeRequest.create({
      senderId: req.user._id,
      receiverId,
      requestedSkillId,
      offeredSkillId,
      proposedDate,
      message
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
      .populate('requestedSkillId', 'name')
      .populate('offeredSkillId', 'name')
      .sort({ createdAt: -1 });

    const received = await ExchangeRequest.find({ receiverId: req.user._id })
      .populate('senderId', 'name username avatarUrl')
      .populate('requestedSkillId', 'name')
      .populate('offeredSkillId', 'name')
      .sort({ createdAt: -1 });

    res.json({ sent, received });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/exchange/:id/status
// @desc    Update request status (accept, reject, cancel, completed)
// @access  Private
router.put('/:id/status', protect, async (req, res) => {
  const { status } = req.body; // 'accepted', 'rejected', 'cancelled', 'completed'

  if (!['accepted', 'rejected', 'cancelled', 'completed'].includes(status)) {
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
    } else if (status === 'completed') {
      // Either party can mark as completed if currently accepted
      if (request.senderId.toString() !== req.user._id.toString() && request.receiverId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'Not authorized to complete' });
      }
      if (request.status !== 'accepted') {
        return res.status(400).json({ message: 'Can only complete accepted requests' });
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
    } else if (status === 'completed') {
      // End the room if it exists
      await Room.findOneAndUpdate(
        { exchangeRequestId: request._id, status: 'active' },
        { status: 'ended', endedAt: Date.now() }
      );
    }

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   PUT /api/exchange/:id/workspace
// @desc    Update workspace (sharedLinks, agendaItems)
// @access  Private
router.put('/:id/workspace', protect, async (req, res) => {
  const { sharedLinks, agendaItems } = req.body;

  try {
    const request = await ExchangeRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Must be participant
    if (request.senderId.toString() !== req.user._id.toString() && request.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Must be accepted
    if (request.status !== 'accepted') {
      return res.status(400).json({ message: 'Session is not active' });
    }

    if (sharedLinks !== undefined) request.sharedLinks = sharedLinks;
    if (agendaItems !== undefined) request.agendaItems = agendaItems;

    await request.save();

    res.json(request);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/exchange/:id
// @desc    Delete an old exchange request (rejected or cancelled)
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const request = await ExchangeRequest.findById(req.params.id);

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    // Authorization checks
    if (request.senderId.toString() !== req.user._id.toString() && request.receiverId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this request' });
    }

    // Cannot delete active or pending requests
    if (request.status === 'pending' || request.status === 'accepted') {
      return res.status(400).json({ message: 'Cannot delete pending or accepted requests' });
    }

    await ExchangeRequest.findByIdAndDelete(req.params.id);

    res.json({ message: 'Request deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
