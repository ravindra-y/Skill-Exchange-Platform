const mongoose = require('mongoose');

const userSkillSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  skillId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Skill',
    required: true,
  },
  type: {
    type: String,
    enum: ['teach', 'learn'],
    required: true,
  },
  level: {
    type: String,
    enum: ['Beginner', 'Intermediate', 'Expert'],
    required: true,
    default: 'Beginner',
  }
});

userSkillSchema.index({ userId: 1, skillId: 1, type: 1 }, { unique: true });

const UserSkill = mongoose.model('UserSkill', userSkillSchema);

module.exports = UserSkill;
