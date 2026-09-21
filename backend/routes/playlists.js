const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const Playlist = require('../models/Playlist');
const Like = require('../models/Like');
const mongoose = require('mongoose');
const https = require('https');

const IMPORT_CAP = 200; // max videos to import from a single YT playlist

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a YouTube video ID (11 chars) from any common YouTube URL. */
function extractYouTubeId(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&]{11})/);
  return (match && match[1].length === 11) ? match[1] : null;
}

/**
 * Extract a YouTube playlist ID (starts with PL / RD / OL / FL / UU etc.)
 * from any URL that has a `list=` query param. Returns null if not found.
 */
function extractYouTubePlaylistId(url) {
  try {
    // Only try to parse strings that look like URLs or contain a list= param.
    // Reject bare strings that have neither a scheme nor the list= marker.
    if (!url.includes('://') && !url.includes('list=')) return null;

    const normalized = url.includes('://') ? url : `https://www.youtube.com/playlist?list=${url}`;
    const u = new URL(normalized);
    const listParam = u.searchParams.get('list');
    // Playlist IDs are typically 13-34 chars; validate alphanumeric + _ -
    if (listParam && /^[A-Za-z0-9_-]{10,}$/.test(listParam)) {
      return listParam;
    }
    return null;
  } catch {
    return null;
  }
}

/** Promisified HTTPS GET → parsed JSON. */
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

// ─── POST /api/playlists/import-yt ────────────────────────────────────────────
// Accepts { playlistUrl } and calls YouTube Data API v3 server-side.
// Returns { videos: [...], totalFetched, sourceTotal, capped } for the
// frontend to preview before saving. The API key never leaves the server.
router.post('/import-yt', protect, async (req, res) => {
  const { playlistUrl } = req.body;

  if (!playlistUrl || !playlistUrl.trim()) {
    return res.status(400).json({ message: 'Please provide a YouTube playlist URL.' });
  }

  const playlistId = extractYouTubePlaylistId(playlistUrl.trim());
  if (!playlistId) {
    return res.status(400).json({ message: "Couldn't parse that playlist link — make sure it contains a valid `list=` parameter." });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ message: 'YouTube API is not configured on this server.' });
  }

  try {
    const videos = [];
    let nextPageToken = '';
    let sourceTotal = 0;

    // Paginate until we hit the cap or run out of pages
    do {
      const pageParam = nextPageToken ? `&pageToken=${encodeURIComponent(nextPageToken)}` : '';
      const apiUrl =
        `https://www.googleapis.com/youtube/v3/playlistItems` +
        `?part=snippet&maxResults=50&playlistId=${encodeURIComponent(playlistId)}${pageParam}&key=${encodeURIComponent(apiKey)}`;

      const { status, body } = await fetchJson(apiUrl);

      // Quota exceeded
      if (status === 403) {
        const reason = body?.error?.errors?.[0]?.reason;
        if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
          return res.status(429).json({ message: 'YouTube API quota exceeded — please try again later.' });
        }
        // Private playlist or forbidden
        return res.status(400).json({ message: 'This playlist is private or unavailable.' });
      }
      if (status === 404) {
        return res.status(400).json({ message: 'This playlist is private or unavailable.' });
      }
      if (status !== 200) {
        return res.status(400).json({ message: 'Failed to fetch playlist from YouTube — check the URL and try again.' });
      }

      // pageInfo.totalResults from the first page gives us the source total
      if (body.pageInfo?.totalResults !== undefined) {
        sourceTotal = body.pageInfo.totalResults;
      }

      // Private playlists may return 200 with 0 items
      if (!body.items || body.items.length === 0) {
        if (videos.length === 0) {
          return res.status(400).json({ message: 'This playlist is private, empty, or unavailable.' });
        }
        break;
      }

      for (const item of body.items) {
        if (videos.length >= IMPORT_CAP) break;
        const videoId = item.snippet?.resourceId?.videoId;
        const title   = item.snippet?.title || '';
        // Deleted/private videos show up as "Deleted video" / "Private video"
        if (!videoId || title === 'Deleted video' || title === 'Private video') continue;
        videos.push({
          url: `https://www.youtube.com/watch?v=${videoId}`,
          videoId,
          title,
        });
      }

      nextPageToken = body.nextPageToken || '';
    } while (nextPageToken && videos.length < IMPORT_CAP);

    if (videos.length === 0) {
      return res.status(400).json({ message: 'No playable videos found in that playlist.' });
    }

    res.json({
      videos,
      totalFetched: videos.length,
      sourceTotal,
      capped: videos.length >= IMPORT_CAP && sourceTotal > IMPORT_CAP,
    });
  } catch (err) {
    console.error('YouTube import error:', err);
    res.status(500).json({ message: 'Failed to import playlist — please try again.' });
  }
});

// GET /api/playlists - list all playlists
// Query: ?sort=newest or ?sort=top (default)
router.get('/', protect, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const sortOption = req.query.sort === 'newest' ? { createdAt: -1 } : { likeCount: -1, createdAt: -1 };

    const playlists = await Playlist.find()
      .populate('creatorId', 'name username')
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const total = await Playlist.countDocuments();
    const hasMore = skip + playlists.length < total;

    // Check which ones the current user liked
    const userLikes = await Like.find({
      userId: req.user._id,
      playlistId: { $in: playlists.map(p => p._id) }
    });
    const likedSet = new Set(userLikes.map(l => l.playlistId.toString()));

    const result = playlists.map(p => ({
      ...p.toObject(),
      isLikedByMe: likedSet.has(p._id.toString())
    }));

    res.json({ playlists: result, hasMore, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching playlists' });
  }
});

// GET /api/playlists/:id - single playlist
router.get('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(404).json({ message: 'Playlist not found' });
    }

    const playlist = await Playlist.findById(req.params.id).populate('creatorId', 'name username');
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });

    const existingLike = await Like.findOne({ playlistId: playlist._id, userId: req.user._id });
    
    res.json({
      ...playlist.toObject(),
      isLikedByMe: !!existingLike
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error fetching playlist' });
  }
});

// POST /api/playlists - create playlist
router.post('/', protect, async (req, res) => {
  try {
    const { title, description, videoUrls } = req.body;
    
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    
    if (!Array.isArray(videoUrls) || videoUrls.length === 0) {
      return res.status(400).json({ message: 'At least one video URL is required' });
    }

    const parsedVideos = [];
    for (const url of videoUrls) {
      if (!url.trim()) continue;
      const videoId = extractYouTubeId(url);
      if (!videoId) {
        return res.status(400).json({ message: `Invalid YouTube URL provided: ${url}` });
      }
      parsedVideos.push({ url, videoId });
    }

    if (parsedVideos.length === 0) {
      return res.status(400).json({ message: 'No valid videos provided' });
    }

    const playlist = new Playlist({
      creatorId: req.user._id,
      title,
      description: description || '',
      videos: parsedVideos
    });

    await playlist.save();
    res.status(201).json(playlist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error creating playlist' });
  }
});

// PUT /api/playlists/:id - edit playlist
router.put('/:id', protect, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });

    if (playlist.creatorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to edit this playlist' });
    }

    const { title, description, videoUrls } = req.body;
    
    if (title) playlist.title = title;
    if (description !== undefined) playlist.description = description;
    
    if (Array.isArray(videoUrls)) {
      const parsedVideos = [];
      for (const url of videoUrls) {
        if (!url.trim()) continue;
        const videoId = extractYouTubeId(url);
        if (!videoId) {
          return res.status(400).json({ message: `Invalid YouTube URL provided: ${url}` });
        }
        parsedVideos.push({ url, videoId });
      }
      if (parsedVideos.length === 0) {
        return res.status(400).json({ message: 'At least one valid video URL is required' });
      }
      playlist.videos = parsedVideos;
    }

    await playlist.save();
    res.json(playlist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error updating playlist' });
  }
});

// DELETE /api/playlists/:id - delete playlist
router.delete('/:id', protect, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });

    if (playlist.creatorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this playlist' });
    }

    await Like.deleteMany({ playlistId: playlist._id });
    await playlist.deleteOne();
    res.json({ message: 'Playlist removed' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error deleting playlist' });
  }
});

// POST /api/playlists/:id/like - toggle like
router.post('/:id/like', protect, async (req, res) => {
  try {
    const playlist = await Playlist.findById(req.params.id);
    if (!playlist) return res.status(404).json({ message: 'Playlist not found' });

    const existingLike = await Like.findOne({ playlistId: playlist._id, userId: req.user._id });

    if (existingLike) {
      // Unlike
      await existingLike.deleteOne();
      playlist.likeCount = Math.max(0, playlist.likeCount - 1);
      await playlist.save();
      res.json({ message: 'Playlist unliked', likeCount: playlist.likeCount, isLikedByMe: false });
    } else {
      // Like
      await Like.create({ playlistId: playlist._id, userId: req.user._id });
      playlist.likeCount += 1;
      await playlist.save();
      res.json({ message: 'Playlist liked', likeCount: playlist.likeCount, isLikedByMe: true });
    }
  } catch (err) {
    // Check for duplicate key error (11000) just in case
    if (err.code === 11000) {
      // Already liked due to race condition
      return res.status(400).json({ message: 'Already liked' });
    }
    console.error(err);
    res.status(500).json({ message: 'Server error toggling like' });
  }
});

module.exports = router;
