import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { Loader2, ArrowLeft, Eye, Edit3 } from 'lucide-react';

export default function BlogEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('write'); // 'write' or 'preview'

  useEffect(() => {
    if (isEditing) {
      const fetchPost = async () => {
        try {
          const { data } = await api.get(`/posts/${id}`);
          setTitle(data.title);
          setContent(data.content);
          setTags(data.tags.join(', '));
        } catch (err) {
          setError('Failed to load post for editing');
        } finally {
          setLoading(false);
        }
      };
      fetchPost();
    }
  }, [id, isEditing]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required');
      return;
    }

    setSaving(true);
    const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);

    try {
      if (isEditing) {
        await api.put(`/posts/${id}`, { title, content, tags: tagArray });
        navigate(`/blog/${id}`);
      } else {
        const { data } = await api.post('/posts', { title, content, tags: tagArray });
        navigate(`/blog/${data._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save post');
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] bg-brand-bg">
      <Loader2 className="w-6 h-6 animate-spin text-brand-text mb-2" />
      <span className="text-sm text-brand-muted">Loading editor...</span>
    </div>
  );

  return (
    <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 py-6 h-[calc(100vh-80px)] flex flex-col">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <Link to={isEditing ? `/blog/${id}` : '/blog'} className="text-brand-muted hover:text-brand-text transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-medium tracking-tight text-brand-text">
            {isEditing ? 'Edit Post' : 'New Post'}
          </h1>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          {isEditing ? 'Save Changes' : 'Publish'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 mb-6 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px] shrink-0">
          {error}
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row gap-6 min-h-0">
        {/* Editor Side */}
        <div className={`flex-1 flex flex-col min-h-0 ${activeTab === 'preview' ? 'hidden md:flex' : 'flex'}`}>
          
          <div className="md:hidden flex items-center bg-brand-surface rounded-t-[8px] border-b border-black/[0.08] p-1 shrink-0">
             <button onClick={() => setActiveTab('write')} className={`flex-1 py-1.5 text-sm font-medium rounded-md ${activeTab === 'write' ? 'bg-black/[0.04] text-brand-text' : 'text-brand-muted'}`}>Write</button>
             <button onClick={() => setActiveTab('preview')} className={`flex-1 py-1.5 text-sm font-medium rounded-md ${activeTab === 'preview' ? 'bg-black/[0.04] text-brand-text' : 'text-brand-muted'}`}>Preview</button>
          </div>

          <div className="flex-1 flex flex-col min-h-0 gap-4 bg-brand-bg md:bg-transparent">
            <input
              type="text"
              placeholder="Post Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-brand-surface border border-black/[0.12] rounded-[8px] text-brand-text placeholder:text-brand-faint px-4 py-3 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-brand-text/20 focus:border-brand-text/40 shrink-0"
            />
            <input
              type="text"
              placeholder="Tags (comma separated, e.g., react, nodejs)"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full bg-brand-surface border border-black/[0.12] rounded-[8px] text-brand-text placeholder:text-brand-faint px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-text/20 focus:border-brand-text/40 shrink-0"
            />
            <textarea
              placeholder="Write your post content using Markdown..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 w-full bg-brand-surface border border-black/[0.12] rounded-[8px] text-brand-text placeholder:text-brand-faint px-4 py-4 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-text/20 focus:border-brand-text/40 resize-none min-h-[300px]"
            />
          </div>
        </div>

        {/* Preview Side */}
        <div className={`flex-1 flex flex-col min-h-0 bg-brand-surface border border-black/[0.08] rounded-[8px] overflow-hidden ${activeTab === 'write' ? 'hidden md:flex' : 'flex'}`}>
          <div className="bg-brand-surface-2 border-b border-black/[0.08] px-4 py-2 flex items-center shrink-0">
            <Eye className="w-4 h-4 text-brand-muted mr-2" />
            <span className="text-sm font-medium text-brand-muted">Preview</span>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {title && <h1 className="mb-6 text-3xl font-bold">{title}</h1>}
            {content ? (
              <MarkdownRenderer content={content} />
            ) : (
              <p className="text-brand-faint italic">Preview will appear here...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
