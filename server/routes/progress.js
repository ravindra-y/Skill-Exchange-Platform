const express = require('express');
const router = express.Router();
const WatchProgress = require('../models/WatchProgress');
const { protect } = require('../middleware/auth');

router.get('/:videoId', protect, async (req, res) => {
  try {
    const progress = await WatchProgress.findOne({
      userId: req.user._id,
      videoId: req.params.videoId
    });
    res.json({ positionSeconds: progress ? progress.positionSeconds : 0 });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching progress' });
  }
});

router.put('/:videoId', protect, async (req, res) => {
  try {
    const { positionSeconds } = req.body;
    const progress = await WatchProgress.findOneAndUpdate(
      { userId: req.user._id, videoId: req.params.videoId },
      { positionSeconds },
      { new: true, upsert: true }
    );
    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: 'Server error saving progress' });
  }
});

module.exports = router;
