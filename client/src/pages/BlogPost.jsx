import React, { useEffect, useState, useContext } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Loader2, ArrowLeft, Edit2, Trash2 } from 'lucide-react';

export default function BlogPost() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

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

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] bg-brand-bg">
      <Loader2 className="w-6 h-6 animate-spin text-brand-text mb-2" />
      <span className="text-sm text-brand-muted">Loading post...</span>
    </div>
  );

  if (error || !post) return (
    <div className="w-full max-w-3xl mx-auto px-6 py-10">
      <div className="px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
        {error || 'Post not found'}
      </div>
      <Link to="/blog" className="mt-4 inline-flex items-center text-sm text-brand-muted hover:text-brand-text">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Blog
      </Link>
    </div>
  );

  const isAuthor = user && post.authorId?._id === user._id;

  return (
    <div className="w-full max-w-3xl mx-auto px-6 py-10 sm:px-8">
      <Link to="/blog" className="inline-flex items-center text-sm text-brand-muted hover:text-brand-text transition-colors mb-8">
        <ArrowLeft className="w-4 h-4 mr-2" /> Back to Blog
      </Link>

      <div className="mb-10">
        <h1 className="text-4xl font-medium tracking-tight text-brand-text mb-4 leading-tight">
          {post.title}
        </h1>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-black/[0.08] pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-surface-2 border border-black/[0.08] flex items-center justify-center shrink-0">
              <span className="text-sm font-medium text-brand-muted">
                {(post.authorId?.name || '?')[0].toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-brand-text">
                {post.authorId?.name || 'Unknown'}
              </p>
              <p className="text-xs text-brand-faint">
                {new Date(post.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          {isAuthor && (
            <div className="flex items-center gap-2">
              <Link to={`/blog/${post._id}/edit`} className="btn-secondary px-3 py-1.5 text-xs">
                <Edit2 className="w-3.5 h-3.5" /> Edit
              </Link>
              <button 
                onClick={handleDelete}
                disabled={deleting}
                className="btn-danger px-3 py-1.5 text-xs"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="prose prose-slate max-w-none text-brand-text prose-a:text-blue-600 hover:prose-a:text-blue-500">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {post.content}
        </ReactMarkdown>
      </div>
      
      {post.tags && post.tags.length > 0 && (
        <div className="mt-10 pt-6 border-t border-black/[0.08] flex flex-wrap gap-2">
          {post.tags.map(tag => (
            <span key={tag} className="px-2.5 py-1 rounded-md bg-brand-surface border border-black/[0.08] text-xs font-medium text-brand-muted">
              #{tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
