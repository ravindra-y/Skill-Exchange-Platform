import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { Loader2, Plus, PenSquare, Search } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const generateExcerpt = (markdown) => {
  if (!markdown) return '';
  const rawHtml = marked.parse(markdown, { breaks: true, gfm: true });
  const cleanHtml = DOMPurify.sanitize(rawHtml);
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = cleanHtml;
  const text = tempDiv.textContent || tempDiv.innerText || '';
  
  const trimmedText = text.replace(/\s+/g, ' ').trim();
  if (trimmedText.length <= 200) return trimmedText;
  
  const lastSpace = trimmedText.lastIndexOf(' ', 200);
  return trimmedText.substring(0, lastSpace > 0 ? lastSpace : 200) + '...';
};

const calculateReadingTime = (markdown) => {
  if (!markdown) return 1;
  const words = markdown.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
};

const TAGS = ['All', 'React', 'JavaScript', 'Python', 'Machine Learning', 'Design', 'Career', 'Web Development'];

export default function BlogList() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState('All');

  const fetchPosts = async (pageNum, append = false, search = searchQuery, tag = selectedTag) => {
    try {
      let url = `/posts?page=${pageNum}&limit=12`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (tag && tag !== 'All') url += `&tag=${encodeURIComponent(tag)}`;

      const { data } = await api.get(url);
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
    setLoading(true);
    setPage(1);
    const delayDebounceFn = setTimeout(() => {
      fetchPosts(1, false, searchQuery, selectedTag);
    }, 300); // debounce search
    
    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, selectedTag]);

  const handleLoadMore = () => {
    setLoadingMore(true);
    setPage(p => p + 1);
    fetchPosts(page + 1, true);
  };

  if (loading && page === 1) return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] bg-brand-bg">
      <Loader2 className="w-6 h-6 animate-spin text-brand-text mb-2" />
      <span className="text-sm text-brand-muted">Loading posts...</span>
    </div>
  );

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-10 sm:px-8">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 gap-4">
        <h1 className="text-3xl font-medium tracking-tight text-brand-text">
          Community Blog
        </h1>
        <Link to="/blog/new" className="btn-primary whitespace-nowrap shadow-sm">
          <Plus className="w-4 h-4 mr-1" />
          Write a Post
        </Link>
      </div>

      <div className="mb-8 space-y-4">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-brand-muted" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2.5 border border-brand-line rounded-lg leading-5 bg-white placeholder-brand-muted focus:outline-none focus:ring-1 focus:ring-brand-text/30 focus:border-brand-text/40 sm:text-sm transition-shadow"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {TAGS.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-4 py-1.5 text-sm rounded-full border transition-all ${
                selectedTag === tag
                  ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                  : 'bg-white text-brand-muted border-brand-line hover:border-gray-400 hover:text-gray-700'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 mb-6 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
          {error}
        </div>
      )}

      {posts.length === 0 ? (
        <div className="empty-card max-w-3xl mx-auto py-16">
          <PenSquare className="w-10 h-10 text-brand-line mx-auto mb-4" />
          <p className="text-base text-brand-muted font-medium">No posts found.</p>
          <p className="text-sm text-brand-faint mt-1">Try adjusting your filters or search query!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map(post => (
            <Link key={post._id} to={`/blog/${post._id}`} className="flex flex-col card hover:border-black/[0.16] hover:shadow-md transition-all duration-200 p-6 group h-full bg-white rounded-xl">
              <div className="flex flex-wrap gap-2 mb-4">
                {(post.tags && post.tags.length > 0 ? post.tags : ['Uncategorized']).slice(0, 2).map((tag, i) => (
                  <span key={i} className="px-2.5 py-1 bg-gray-100 text-gray-600 text-xs rounded-md font-medium tracking-wide">
                    #{tag}
                  </span>
                ))}
              </div>
              <h2 className="text-xl font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-2 line-clamp-2 leading-snug">
                {post.title}
              </h2>
              <p className="text-sm text-gray-500 mb-6 line-clamp-2 flex-grow leading-relaxed">
                {generateExcerpt(post.content)}
              </p>
              
              <div className="flex items-center mt-auto pt-4 border-t border-gray-100">
                <div className="h-9 w-9 rounded-full bg-gray-100 border border-gray-200 overflow-hidden flex-shrink-0">
                  {post.authorId?.profilePicture ? (
                    <img src={post.authorId.profilePicture} alt={post.authorId?.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-sm font-medium text-gray-500 bg-gray-100">
                      {post.authorId?.name?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                  )}
                </div>
                <div className="ml-3 flex-1 overflow-hidden">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {post.authorId?.name || 'Unknown'}
                  </p>
                  <div className="flex items-center text-xs text-gray-500 mt-0.5">
                    <span>{new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    <span className="mx-1.5">&middot;</span>
                    <span className="flex items-center font-medium">
                      ⚡ {calculateReadingTime(post.content)} min read
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center pt-10 pb-4">
          <button
            onClick={handleLoadMore}
            disabled={loadingMore}
            className="btn-secondary px-8 py-2 rounded-full font-medium shadow-sm"
          >
            {loadingMore ? <Loader2 className="w-4 h-4 animate-spin mr-2 inline" /> : null}
            Load More Posts
          </button>
        </div>
      )}
    </div>
  );
}
