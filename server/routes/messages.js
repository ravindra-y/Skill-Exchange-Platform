const express = require('express');
const mongoose = require('mongoose');
const { body, query, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const ExchangeRequest = require('../models/ExchangeRequest');
const Message = require('../models/Message');

const router = express.Router();

// ─── Shared helper: verify the calling user is a participant of an accepted request ──
async function assertParticipant(exchangeRequestId, userId) {
  if (!mongoose.Types.ObjectId.isValid(exchangeRequestId)) {
    const err = new Error('Invalid exchangeRequestId');
    err.status = 400;
    throw err;
  }
  const exReq = await ExchangeRequest.findById(exchangeRequestId);
  if (!exReq) {
    const err = new Error('Exchange request not found');
    err.status = 404;
    throw err;
  }
  if (exReq.status !== 'accepted') {
    const err = new Error('Exchange request is not accepted');
    err.status = 403;
    throw err;
  }
  const senderId   = exReq.senderId.toString();
  const receiverId = exReq.receiverId.toString();
  if (userId !== senderId && userId !== receiverId) {
    const err = new Error('Forbidden: you are not a participant in this conversation');
    err.status = 403;
    throw err;
  }
  return exReq;
}

// ─── GET /api/messages/:exchangeRequestId ────────────────────────────────────
// Paginated history, cursor-based via `before` (ISO timestamp).
// Returns up to `limit` messages (max 50) ordered oldest-first within the page.
// @access Private
router.get(
  '/:exchangeRequestId',
  protect,
  [
    query('limit')
      .optional()
      .isInt({ min: 1, max: 50 })
      .withMessage('limit must be 1–50'),
    query('before')
      .optional()
      .isISO8601()
      .withMessage('before must be an ISO 8601 date'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      await assertParticipant(req.params.exchangeRequestId, req.user._id.toString());

      const limit  = Math.min(parseInt(req.query.limit || '30', 10), 50);
      const filter = { exchangeRequestId: req.params.exchangeRequestId };

      if (req.query.before) {
        filter.createdAt = { $lt: new Date(req.query.before) };
      }

      // Fetch one extra to know if there are more pages
      const messages = await Message.find(filter)
        .sort({ createdAt: -1 }) // newest-first so we get the right `limit` docs
        .limit(limit + 1)
        .populate('senderId', 'name username')
        .lean();

      const hasMore = messages.length > limit;
      if (hasMore) messages.pop();

      // Return oldest-first for the client to render top→bottom
      messages.reverse();

      res.json({ messages, hasMore });
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

// ─── POST /api/messages/:exchangeRequestId ───────────────────────────────────
// HTTP fallback to send a message when Socket.io is unavailable.
// Persists to DB, then emits via Socket.io if available.
// @access Private
router.post(
  '/:exchangeRequestId',
  protect,
  [
    body('text')
      .trim()
      .notEmpty().withMessage('Message text is required')
      .isLength({ max: 4000 }).withMessage('Message must be at most 4000 characters'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: errors.array()[0].msg });
    }

    try {
      await assertParticipant(req.params.exchangeRequestId, req.user._id.toString());

      const message = await Message.create({
        exchangeRequestId: req.params.exchangeRequestId,
        senderId: req.user._id,
        text: req.body.text.trim(),
      });

      const populated = await message.populate('senderId', 'name username');

      // Emit via Socket.io so the recipient gets it in real time even though
      // this came in via HTTP (e.g. the sender's socket was temporarily disconnected)
      const io = req.app.get('io');
      if (io) {
        io.to('chat:' + req.params.exchangeRequestId).emit('chat:message', populated);
      }

      res.status(201).json(populated);
    } catch (err) {
      res.status(err.status || 500).json({ message: err.message });
    }
  }
);

// ─── POST /api/messages/:exchangeRequestId/read ──────────────────────────────
// Mark all messages in a conversation as read for the calling user.
// @access Private
router.post('/:exchangeRequestId/read', protect, async (req, res) => {
  try {
    await assertParticipant(req.params.exchangeRequestId, req.user._id.toString());

    // Only mark messages sent by the OTHER user that are still unread
    await Message.updateMany(
      {
        exchangeRequestId: req.params.exchangeRequestId,
        senderId: { $ne: req.user._id },
        readAt: null,
      },
      { $set: { readAt: new Date() } }
    );

    res.json({ ok: true });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

// ─── GET /api/messages/unread/counts ─────────────────────────────────────────
// Returns unread message counts for all accepted exchanges the user is in.
// @access Private
router.get('/unread/counts', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all accepted exchange requests this user is part of
    const acceptedExchanges = await ExchangeRequest.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
      status: 'accepted',
    }).select('_id').lean();

    const ids = acceptedExchanges.map(e => e._id);

    // Count unread messages (sent by others, not yet readAt) per conversation
    const counts = await Message.aggregate([
      {
        $match: {
          exchangeRequestId: { $in: ids },
          senderId: { $ne: userId },
          readAt: null,
        },
      },
      {
        $group: {
          _id: '$exchangeRequestId',
          count: { $sum: 1 },
        },
      },
    ]);

    // Shape into { [exchangeRequestId]: count }
    const result = {};
    for (const c of counts) {
      result[c._id.toString()] = c.count;
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ─── DELETE /api/messages/:exchangeRequestId ───────────────────────────────
// Delete all messages in a conversation (hard delete for both users).
// @access Private
router.delete('/:exchangeRequestId', protect, async (req, res) => {
  try {
    await assertParticipant(req.params.exchangeRequestId, req.user._id.toString());

    await Message.deleteMany({ exchangeRequestId: req.params.exchangeRequestId });

    res.json({ ok: true, message: 'Conversation deleted' });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
});

module.exports = router;
