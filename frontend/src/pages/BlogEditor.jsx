import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { 
  Loader2, ArrowLeft, Eye, Edit3, 
  Bold, Italic, Heading2, Link as LinkIcon, Code, Quote 
} from 'lucide-react';

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
  const textareaRef = useRef(null);

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

  const insertFormatting = (before, after = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);
    const newText = before + selectedText + after;
    
    setContent(content.substring(0, start) + newText + content.substring(end));
    
    // Focus back and set cursor
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] bg-gray-50">
      <Loader2 className="w-6 h-6 animate-spin text-blue-600 mb-2" />
      <span className="text-sm text-gray-500">Loading editor...</span>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div className="flex items-center gap-4">
          <Link to={isEditing ? `/blog/${id}` : '/blog'} className="p-2 rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {isEditing ? 'Edit Post' : 'New Post'}
          </h1>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary w-full sm:w-auto shadow-sm bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2 inline" /> : null}
          {isEditing ? 'Save Changes' : 'Publish Post'}
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 mb-6 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Post Title</label>
          <input
            type="text"
            placeholder="E.g., How to build a React app..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 px-4 py-3 text-lg font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">Tags</label>
          <input
            type="text"
            placeholder="react, web development, tutorial"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-shadow"
          />
        </div>

        <div className="border border-gray-300 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col">
          {/* Tab Bar */}
          <div className="flex items-center bg-gray-50 border-b border-gray-300 px-2 pt-2">
            <button 
              onClick={() => setActiveTab('write')} 
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'write' 
                  ? 'bg-white text-gray-900 border-x border-t border-gray-300 translate-y-[1px]' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Edit3 className="w-4 h-4" /> Write
            </button>
            <button 
              onClick={() => setActiveTab('preview')} 
              className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === 'preview' 
                  ? 'bg-white text-gray-900 border-x border-t border-gray-300 translate-y-[1px]' 
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
          </div>

          {activeTab === 'write' ? (
            <div className="flex flex-col">
              {/* Formatting Toolbar */}
              <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 bg-white">
                <button type="button" onClick={() => insertFormatting('**', '**')} className="p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors" title="Bold">
                  <Bold className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => insertFormatting('*', '*')} className="p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors" title="Italic">
                  <Italic className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-gray-300 mx-1"></div>
                <button type="button" onClick={() => insertFormatting('## ')} className="p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors" title="Heading 2">
                  <Heading2 className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => insertFormatting('> ')} className="p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors" title="Quote">
                  <Quote className="w-4 h-4" />
                </button>
                <div className="w-px h-5 bg-gray-300 mx-1"></div>
                <button type="button" onClick={() => insertFormatting('[', '](url)')} className="p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors" title="Link">
                  <LinkIcon className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => insertFormatting('`', '`')} className="p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors" title="Inline Code">
                  <Code className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => insertFormatting('\n```\n', '\n```\n')} className="p-2 text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-md transition-colors text-xs font-semibold font-mono flex items-center justify-center w-8 h-8" title="Code Block">
                  &lt;/&gt;
                </button>
              </div>
              
              <textarea
                ref={textareaRef}
                placeholder="Write your post content using Markdown..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-white text-gray-900 placeholder:text-gray-400 px-5 py-4 text-base font-mono focus:outline-none resize-y min-h-[400px] leading-relaxed"
              />
            </div>
          ) : (
            <div className="p-6 sm:p-8 min-h-[460px] bg-white">
              {title && <h1 className="mb-8 font-bold text-gray-900">{title}</h1>}
              {content ? (
                <MarkdownRenderer content={content} />
              ) : (
                <p className="text-gray-400 italic">Preview will appear here...</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
