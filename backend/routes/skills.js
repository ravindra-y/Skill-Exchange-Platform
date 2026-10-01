const express = require('express');
const Skill = require('../models/Skill');
const escoService = require('../services/escoService');

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

// @route   GET /api/skills/search
// @desc    Search skills from ESCO dataset / API with prefix, alias & fuzzy matching
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || typeof q !== 'string' || q.trim().length === 0) {
      return res.json([]);
    }

    const limit = parseInt(req.query.limit, 10) || 8;
    const results = await escoService.search(q.trim(), limit);
    res.json(results);
  } catch (error) {
    console.error('Skill Search Error:', error.message);
    res.status(500).json({ message: 'Failed to search skills', error: error.message });
  }
});

// @route   POST /api/skills
// @desc    Find or create a skill with canonical name normalization (prevents duplicate variants)
// @access  Public
router.post('/', async (req, res) => {
  try {
    const { name, category, escoUri } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Skill name is required' });
    }

    // Resolve canonical representation
    const canonical = escoService.getCanonical(name.trim());
    const canonicalName = canonical ? canonical.canonicalName : name.trim();
    const finalCategory = category || (canonical ? canonical.category : 'General');

    // Case-insensitive search to prevent duplicates like "react" vs "React"
    let skill = await Skill.findOne({
      name: { $regex: new RegExp(`^${canonicalName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
    });

    if (!skill) {
      skill = await Skill.create({
        name: canonicalName,
        category: finalCategory
      });
    }

    res.status(201).json(skill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
