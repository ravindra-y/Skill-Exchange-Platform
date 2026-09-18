import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { 
  Loader2, ArrowLeft, Edit2, Trash2, Heart, 
  Bookmark, Share, MoreVertical, MessageCircle, User 
} from 'lucide-react';

const calculateReadingTime = (markdown) => {
  if (!markdown) return 1;
  const words = markdown.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
};

export default function BlogPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Mock engagement state
  const [likes, setLikes] = useState(Math.floor(Math.random() * 50) + 5);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const { data } = await api.get(`/posts/${id}`);
        setPost(data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load post');
      } finally {
        setLoading(false);
      }
    };
    fetchPost();
  }, [id]);

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    setDeleting(true);
    try {
      await api.delete(`/posts/${id}`);
      navigate('/blog');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete post');
      setDeleting(false);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy', err);
    }
  };

  const toggleLike = () => {
    if (isLiked) {
      setLikes(prev => prev - 1);
      setIsLiked(false);
    } else {
      setLikes(prev => prev + 1);
      setIsLiked(true);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] bg-brand-bg">
      <Loader2 className="w-6 h-6 animate-spin text-brand-text mb-2" />
      <span className="text-sm text-brand-muted">Loading article...</span>
    </div>
  );

  if (error || !post) return (
    <div className="w-full max-w-3xl mx-auto px-6 py-10">
      <div className="px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-lg shadow-sm">
        {error || 'Article not found'}
      </div>
      <Link to="/blog" className="mt-6 inline-flex items-center text-sm font-medium text-brand-muted hover:text-brand-text transition-colors">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Blog
      </Link>
    </div>
  );

  const isAuthor = user && post.authorId?._id === user._id;

  return (
    <div className="w-full max-w-3xl mx-auto px-5 py-10 sm:px-8 sm:py-16">
      <Link to="/blog" className="inline-flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors mb-10 group">
        <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform" /> Back to Blog
      </Link>

      <article>
        {/* Article Header */}
        <header className="mb-10">
          {post.tags && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-6">
              {post.tags.map(tag => (
                <span key={tag} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold tracking-wide uppercase">
                  {tag}
                </span>
              ))}
            </div>
          )}
          
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-8 leading-tight tracking-tight">
            {post.title}
          </h1>
          
          {/* Author & Metadata Bar */}
          <div className="flex items-center justify-between py-4 border-y border-gray-100 relative">
            <div className="flex items-center gap-4">
              <Link to={`/profile/${post.authorId?._id}`} className="block h-12 w-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 hover:ring-2 hover:ring-gray-200 transition-all">
                {post.authorId?.profilePicture ? (
                  <img src={post.authorId.profilePicture} alt={post.authorId?.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-lg font-medium text-gray-600">
                    {(post.authorId?.name || '?')[0].toUpperCase()}
                  </div>
                )}
              </Link>
              <div>
                <Link to={`/profile/${post.authorId?._id}`} className="block text-base font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                  {post.authorId?.name || 'Unknown'}
                </Link>
                <div className="flex items-center text-sm text-gray-500 mt-0.5">
                  <span>{new Date(post.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  <span className="mx-2">&middot;</span>
                  <span className="flex items-center">
                    ⚡ {calculateReadingTime(post.content)} min read
                  </span>
                </div>
              </div>
            </div>
            
            {isAuthor && (
              <div className="relative">
                <button 
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-10">
                    <Link 
                      to={`/blog/${post._id}/edit`} 
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 w-full text-left"
                    >
                      <Edit2 className="w-4 h-4 mr-2" /> Edit Post
                    </Link>
                    <button 
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full text-left"
                    >
                      {deleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                      Delete Post
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Content Container */}
        <div className="text-gray-800 leading-loose text-[1.05rem]">
          <MarkdownRenderer content={post.content} />
        </div>
        
        {/* Engagement Controls */}
        <div className="flex items-center justify-between py-6 mt-12 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleLike}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                isLiked 
                  ? 'bg-red-50 border-red-200 text-red-600 shadow-sm' 
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900'
              }`}
            >
              <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
              <span className="font-medium">{likes}</span>
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsBookmarked(!isBookmarked)}
              className={`p-2.5 rounded-full border transition-all ${
                isBookmarked 
                  ? 'bg-blue-50 border-blue-200 text-blue-600 shadow-sm' 
                  : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900'
              }`}
              title="Bookmark"
            >
              <Bookmark className={`w-5 h-5 ${isBookmarked ? 'fill-current' : ''}`} />
            </button>
            <button 
              onClick={handleShare}
              className="p-2.5 rounded-full bg-white border border-gray-200 text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-900 transition-all"
              title="Share Link"
            >
              <Share className="w-5 h-5" />
            </button>
          </div>
        </div>
      </article>

      {/* Author Bio Card */}
      <div className="mt-12 bg-gray-50 rounded-2xl p-6 sm:p-8 border border-gray-100">
        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-6">About the Author</h3>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <Link to={`/profile/${post.authorId?._id}`} className="shrink-0">
            <div className="h-20 w-20 rounded-full bg-white border-2 border-gray-200 overflow-hidden shadow-sm">
              {post.authorId?.profilePicture ? (
                <img src={post.authorId.profilePicture} alt={post.authorId?.name} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-2xl font-bold text-gray-400">
                  {(post.authorId?.name || '?')[0].toUpperCase()}
                </div>
              )}
            </div>
          </Link>
          <div className="text-center sm:text-left flex-1">
            <Link to={`/profile/${post.authorId?._id}`} className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors">
              {post.authorId?.name || 'Unknown User'}
            </Link>
            <p className="text-gray-600 mt-2 text-sm leading-relaxed max-w-xl">
              Knowledge sharer and active community member. Dedicated to helping others learn and grow on the Skill Exchange Platform.
            </p>
            <div className="mt-4 flex items-center justify-center sm:justify-start gap-3">
              <Link to={`/profile/${post.authorId?._id}`} className="inline-flex items-center px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-all shadow-sm">
                <User className="w-4 h-4 mr-2" /> View Profile
              </Link>
              {!isAuthor && (
                <Link to={`/messages/${post.authorId?._id}`} className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-all shadow-sm">
                  <MessageCircle className="w-4 h-4 mr-2" /> Message
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
      
    </div>
  );
}
