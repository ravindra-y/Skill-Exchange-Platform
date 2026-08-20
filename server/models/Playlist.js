const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    videoId: { type: String, required: true },
    title: { type: String, default: '' },   // optional; populated when imported from YouTube
    addedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const playlistSchema = new mongoose.Schema(
  {
    creatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    videos: [videoSchema],
    likeCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Optimize sorting
playlistSchema.index({ likeCount: -1, createdAt: -1 });
playlistSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Playlist', playlistSchema);
