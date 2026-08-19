const express = require('express');
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const UserSkill = require('../models/UserSkill');
const ExchangeRequest = require('../models/ExchangeRequest');

const router = express.Router();

// @route   GET /api/discover
// @desc    Get matched users based on skill exchange algorithm
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const currentUserId = req.user._id;

    // 1. Get current user's skills
    const mySkills = await UserSkill.find({ userId: currentUserId });
    const myTeachSkills = mySkills.filter(s => s.type === 'teach').map(s => s.skillId.toString());
    const myLearnSkills = mySkills.filter(s => s.type === 'learn').map(s => s.skillId.toString());

    if (myTeachSkills.length === 0 || myLearnSkills.length === 0) {
      return res.json([]); // Need both to compute a match score
    }

    // 2. Find other users who teach what I want to learn, OR want to learn what I teach
    // For a more comprehensive discover, we could just fetch all other users and compute scores
    // but filtering early is better. For now, let's just fetch all other users with any skills.
    
    // Find all UserSkills NOT belonging to me
    const otherUserSkills = await UserSkill.find({ userId: { $ne: currentUserId } }).populate('userId', 'name username bio avatarUrl');
    
    // Group by user
    const usersMap = {};
    otherUserSkills.forEach(us => {
      const uId = us.userId._id.toString();
      if (!usersMap[uId]) {
        usersMap[uId] = {
          user: us.userId,
          teach: [],
          learn: []
        };
      }
      if (us.type === 'teach') {
        usersMap[uId].teach.push(us.skillId.toString());
      } else {
        usersMap[uId].learn.push(us.skillId.toString());
      }
    });

    const matches = [];

    // Fetch existing exchange requests involving the current user
    const myRequests = await ExchangeRequest.find({
      $or: [{ senderId: currentUserId }, { receiverId: currentUserId }]
    });

    // 3. Compute matching algorithm for each user
    for (const [uId, data] of Object.entries(usersMap)) {
      if (data.teach.length === 0 || data.learn.length === 0) continue;

      // A's teach skills that B wants (My teach skills that They learn)
      let aTeachBWantCount = 0;
      myTeachSkills.forEach(skill => {
        if (data.learn.includes(skill)) aTeachBWantCount++;
      });
      const forwardMatch = aTeachBWantCount / myTeachSkills.length;

      // B's teach skills that A wants (Their teach skills that I learn)
      let bTeachAWantCount = 0;
      data.teach.forEach(skill => {
        if (myLearnSkills.includes(skill)) bTeachAWantCount++;
      });
      const reverseMatch = bTeachAWantCount / data.teach.length;

      const overallScore = ((forwardMatch + reverseMatch) / 2) * 100;

      if (overallScore > 0) {
        let label = 'Low';
        if (overallScore >= 90) label = 'Excellent';
        else if (overallScore >= 70) label = 'Good';
        else if (overallScore >= 40) label = 'Moderate';

        // Check if there's an existing request
        let existingRequest = null;
        const reqDoc = myRequests.find(r => 
          r.senderId.toString() === uId || r.receiverId.toString() === uId
        );

        if (reqDoc) {
          existingRequest = {
            id: reqDoc._id,
            status: reqDoc.status,
            direction: reqDoc.senderId.toString() === currentUserId.toString() ? 'sent' : 'received'
          };
        }

        matches.push({
          user: data.user,
          score: Math.round(overallScore),
          label,
          existingRequest
        });
      }
    }

    // Sort descending by score
    matches.sort((a, b) => b.score - a.score);

    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
