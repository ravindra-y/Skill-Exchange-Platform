import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Loader2, Plus, PenSquare } from 'lucide-react';

export default function BlogList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchPosts = async (pageNum, append = false) => {
    try {
      const { data } = await api.get(`/posts?page=${pageNum}&limit=10`);
      setPosts(prev => append ? [...prev, ...data.posts] : data.posts);
      setHasMore(data.hasMore);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load blog posts');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchPosts(1, false);
  }, []);

  const handleLoadMore = () => {
    setLoadingMore(true);
    setPage(p => p + 1);
    fetchPosts(page + 1, true);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] bg-brand-bg">
      <Loader2 className="w-6 h-6 animate-spin text-brand-text mb-2" />
      <span className="text-sm text-brand-muted">Loading posts...</span>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10 sm:px-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-medium tracking-tight text-brand-text">
          Community Blog
        </h1>
        <Link to="/blog/new" className="btn-primary">
          <Plus className="w-4 h-4" />
          Write a Post
        </Link>
      </div>

      {error && (
        <div className="px-4 py-3 mb-6 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
          {error}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="empty-card">
          <PenSquare className="w-8 h-8 text-brand-line mx-auto mb-3" />
          <p className="text-sm text-brand-muted">No posts yet.</p>
          <p className="text-xs text-brand-faint mt-1">Be the first to share your knowledge!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => (
            <Link key={post._id} to={`/blog/${post._id}`} className="block card hover:border-black/[0.16] transition-colors p-6 group">
              <h2 className="text-xl font-medium text-brand-text group-hover:text-brand-text/80 transition-colors mb-2">
                {post.title}
              </h2>
              <p className="text-sm text-brand-muted mb-4 line-clamp-2">
                {post.content.replace(/[#*`_]/g, '')}
              </p>
              <div className="flex items-center justify-between text-xs text-brand-faint">
                <span className="font-medium text-brand-muted">By {post.authorId?.name || 'Unknown'}</span>
                <span>{new Date(post.createdAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}

          {hasMore && (
            <div className="flex justify-center pt-6">
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
      )}
    </div>
  );
}
