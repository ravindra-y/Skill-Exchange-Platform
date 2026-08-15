const express = require('express');
const Skill = require('../models/Skill');

const router = express.Router();

// @route   GET /api/skills
// @desc    Get all skills available for selection
// @access  Public
router.get('/', async (req, res) => {
  try {
    const skills = await Skill.find({}).sort({ name: 1 });
    res.json(skills);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
