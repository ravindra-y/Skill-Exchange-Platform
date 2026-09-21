const mongoose = require('mongoose');

const likeSchema = new mongoose.Schema(
  {
    playlistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Playlist',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// A user can only like a playlist once
likeSchema.index({ playlistId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Like', likeSchema);
