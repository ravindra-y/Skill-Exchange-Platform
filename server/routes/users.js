const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const UserSkill = require('../models/UserSkill');
const ExchangeRequest = require('../models/ExchangeRequest');
const Message = require('../models/Message');
const Room = require('../models/Room');
const RoomParticipant = require('../models/RoomParticipant');
const mongoose = require('mongoose');

const router = express.Router();

// ─── Profile update validation ────────────────────────────────────────────────
const profileValidation = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 60 }).withMessage('Name must be 2–60 characters'),
  body('bio')
    .optional()
    .trim()
    .isLength({ max: 500 }).withMessage('Bio must be at most 500 characters'),
  body('avatarUrl')
    .optional()
    .trim()
    .isURL({ require_protocol: true }).withMessage('avatarUrl must be a valid URL'),
];

// ─── Skill add validation ─────────────────────────────────────────────────────
const skillValidation = [
  body('skillId')
    .notEmpty().withMessage('skillId is required')
    .custom(val => mongoose.Types.ObjectId.isValid(val)).withMessage('Invalid skillId'),
  body('type')
    .isIn(['teach', 'learn']).withMessage('type must be "teach" or "learn"'),
];

// @route   PUT /api/users/profile
// @access  Private — user can only edit their own profile (JWT id used, no body id accepted)
router.put('/profile', protect, profileValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  try {
    // Always use req.user._id from the verified JWT — never trust a body userId
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (req.body.name      !== undefined) user.name      = req.body.name;
    if (req.body.bio       !== undefined) user.bio       = req.body.bio;
    if (req.body.avatarUrl !== undefined) user.avatarUrl = req.body.avatarUrl;

    const updatedUser = await user.save();
    res.json({
      _id:       updatedUser._id,
      name:      updatedUser.name,
      username:  updatedUser.username,
      email:     updatedUser.email,
      bio:       updatedUser.bio,
      avatarUrl: updatedUser.avatarUrl,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   POST /api/users/skills
// @access  Private — always writes to the JWT user's skills, never a foreign userId
router.post('/skills', protect, skillValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: errors.array()[0].msg });
  }

  const { skillId, type } = req.body;

  try {
    const existing = await UserSkill.findOne({ userId: req.user._id, skillId, type });
    if (existing) {
      return res.status(400).json({ message: `Skill already added to ${type} list` });
    }

    const userSkill = await UserSkill.create({ userId: req.user._id, skillId, type });
    const populated = await userSkill.populate('skillId');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/users/skills
// @access  Private
router.get('/skills', protect, async (req, res) => {
  try {
    const skills = await UserSkill.find({ userId: req.user._id }).populate('skillId');
    res.json(skills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   DELETE /api/users/skills/:id
// @access  Private — findOne({ _id, userId: req.user._id }) ensures ownership
router.delete('/skills/:id', protect, async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid skill id' });
  }
  try {
    // Ownership enforced: only deletes if both _id matches AND userId matches JWT
    const userSkill = await UserSkill.findOne({ _id: req.params.id, userId: req.user._id });
    if (!userSkill) return res.status(404).json({ message: 'User skill not found' });

    await userSkill.deleteOne();
    res.json({ message: 'Skill removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;

// @route   DELETE /api/users/me
// @access  Private — user deletes their own account
router.delete('/me', protect, async (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ message: 'Password is required to confirm deletion' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Re-authenticate
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Incorrect password' });
    }

    const userId = user._id;

    // Use a transaction if supported, else safe-order deletion
    let session = null;
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch (e) {
      // If transactions are not supported (e.g. standalone mongod), session stays null
      session = null;
    }

    const opts = session ? { session } : {};

    try {
      // 1. Find all exchange requests involving the user
      const requests = await ExchangeRequest.find({
        $or: [{ senderId: userId }, { receiverId: userId }]
      }, null, opts);
      const requestIds = requests.map(r => r._id);

      // 2. Find all rooms related to those requests
      const rooms = await Room.find({ exchangeRequestId: { $in: requestIds } }, null, opts);
      const roomIds = rooms.map(r => r._id);

      // 3. Delete messages in those requests
      await Message.deleteMany({ exchangeRequestId: { $in: requestIds } }, opts);

      // 4. Delete RoomParticipants in those rooms (and any dangling ones for this user)
      await RoomParticipant.deleteMany({
        $or: [{ roomId: { $in: roomIds } }, { userId }]
      }, opts);

      // 5. Delete the rooms
      await Room.deleteMany({ _id: { $in: roomIds } }, opts);

      // 6. Delete the exchange requests
      await ExchangeRequest.deleteMany({ _id: { $in: requestIds } }, opts);

      // 7. Delete user's skills
      await UserSkill.deleteMany({ userId }, opts);

      // 8. Delete the user
      await User.deleteOne({ _id: userId }, opts);

      if (session) {
        await session.commitTransaction();
        session.endSession();
      }
    } catch (err) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      throw err;
    }

    // Invalidate session
    res.cookie('jwt', '', { httpOnly: true, expires: new Date(0) });
    res.json({ message: 'Account and all related data deleted successfully' });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
