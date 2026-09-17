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
// @route   GET /api/skills/search
// @desc    Search skills from ESCO API
// @access  Public
router.get('/search', async (req, res) => {
  try {
    const q = req.query.q;
    if (!q || q.trim().length < 2) {
      return res.json([]);
    }

    const escoUrl = `https://ec.europa.eu/esco/api/suggest2?text=${encodeURIComponent(q.trim())}&language=en&type=skill&offset=0&limit=10&alt=true&selectedVersion=latest&viewObsolete=false`;
    
    // Use dynamic import for node-fetch or use native fetch if Node 18+ (which is likely)
    const response = await fetch(escoUrl);
    if (!response.ok) {
      throw new Error(`ESCO API responded with status ${response.status}`);
    }
    const data = await response.json();
    
    const results = data._embedded?.results || [];
    const mappedSkills = results.map(item => ({
      id: item.uri,
      name: item.title,
    }));

    res.json(mappedSkills);
  } catch (error) {
    console.error('ESCO API Error:', error.message);
    // Return empty array on external API error to not break the page completely
    res.json([]);
  }
});

// @route   POST /api/skills
// @desc    Find or create a skill (used when selecting an ESCO skill)
// @access  Private (or Public if no protect middleware)
router.post('/', async (req, res) => {
  try {
    const { name, category } = req.body;
    if (!name) return res.status(400).json({ message: 'Skill name is required' });
    
    let skill = await Skill.findOne({ name });
    if (!skill) {
      skill = await Skill.create({ name, category: category || 'Other' });
    }
    res.status(201).json(skill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
