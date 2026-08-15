const express = require('express');
const { body, param, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const UserSkill = require('../models/UserSkill');
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
