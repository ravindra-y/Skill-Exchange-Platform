import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Loader2, Plus, ListVideo, ThumbsUp, Calendar } from 'lucide-react';

export default function PlaylistList() {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sort, setSort] = useState('top'); // 'top' or 'newest'

  const fetchPlaylists = async (pageNum, currentSort, append = false) => {
    try {
      const { data } = await api.get(`/playlists?page=${pageNum}&limit=12&sort=${currentSort}`);
      setPlaylists(prev => append ? [...prev, ...data.playlists] : data.playlists);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load playlists');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    setPage(1);
    fetchPlaylists(1, sort, false);
  }, [sort]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    setPage(p => p + 1);
    fetchPlaylists(page + 1, sort, true);
  };

  if (loading && page === 1) return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] bg-brand-bg">
      <Loader2 className="w-6 h-6 animate-spin text-brand-text mb-2" />
      <span className="text-sm text-brand-muted">Loading playlists...</span>
    </div>
  );

  return (
    <div className="w-full max-w-6xl mx-auto px-6 py-10 sm:px-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-medium tracking-tight text-brand-text flex items-center gap-3">
          <ListVideo className="w-8 h-8 text-brand-line" />
          Playlister
        </h1>
        <div className="flex items-center gap-4">
          <div className="bg-brand-surface border border-black/[0.08] p-1 rounded-[8px] flex items-center">
            <button 
              onClick={() => setSort('top')}
              className={`px-3 py-1.5 text-xs font-medium rounded-[4px] flex items-center gap-1.5 transition-colors ${sort === 'top' ? 'bg-black/[0.04] text-brand-text' : 'text-brand-muted hover:text-brand-text'}`}
            >
              <ThumbsUp className="w-3.5 h-3.5" /> Top Rated
            </button>
            <button 
              onClick={() => setSort('newest')}
              className={`px-3 py-1.5 text-xs font-medium rounded-[4px] flex items-center gap-1.5 transition-colors ${sort === 'newest' ? 'bg-black/[0.04] text-brand-text' : 'text-brand-muted hover:text-brand-text'}`}
            >
              <Calendar className="w-3.5 h-3.5" /> Newest
            </button>
          </div>
          <Link to="/playlister/new" className="btn-primary whitespace-nowrap">
            <Plus className="w-4 h-4 mr-1.5" />
            Create Playlist
          </Link>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 mb-6 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
          {error}
        </div>
      )}

      {playlists.length === 0 ? (
        <div className="empty-card">
          <ListVideo className="w-8 h-8 text-brand-line mx-auto mb-3" />
          <p className="text-sm text-brand-muted">No playlists found.</p>
          <p className="text-xs text-brand-faint mt-1">Create the first one to share your favorite videos!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {playlists.map(playlist => {
            const firstVideo = playlist.videos[0];
            const thumbnailUrl = firstVideo ? `https://img.youtube.com/vi/${firstVideo.videoId}/hqdefault.jpg` : '';
            return (
              <Link key={playlist._id} to={`/playlister/${playlist._id}`} className="group flex flex-col bg-brand-surface border border-black/[0.08] rounded-[12px] overflow-hidden hover:border-black/[0.16] transition-colors">
                <div className="aspect-video bg-brand-surface-2 relative">
                  {thumbnailUrl ? (
                    <img src={thumbnailUrl} alt="Thumbnail" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-brand-faint">No video</div>
                  )}
                  <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded">
                    {playlist.videos.length} video{playlist.videos.length !== 1 && 's'}
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h2 className="text-sm font-medium text-brand-text line-clamp-2 mb-1 group-hover:text-brand-text/80 transition-colors">
                    {playlist.title}
                  </h2>
                  <p className="text-xs text-brand-muted mb-3 flex-1">
                    By {playlist.creatorId?.name || 'Unknown'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-brand-faint">
                    <span className="flex items-center gap-1.5 font-medium">
                      <ThumbsUp className={`w-3.5 h-3.5 ${playlist.isLikedByMe ? 'text-brand-text fill-brand-text' : ''}`} /> 
                      {playlist.likeCount}
                    </span>
                    <span>{new Date(playlist.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-8">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="btn-secondary"
          >
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2 inline" /> : null}
            Load More
          </button>
        </div>
      )}
    </div>
  );
}
