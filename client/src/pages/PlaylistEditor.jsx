import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../api/axios';
import { Loader2, ArrowLeft, Plus, X, Video, Download, CheckCircle } from 'lucide-react';

export default function PlaylistEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  // Each entry: { url, videoId, title? }  — same shape as the API stores
  const [videos, setVideos] = useState([{ url: '', videoId: null, title: '' }]);
  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Import-from-YT state ──────────────────────────────────────────────────
  const [importUrl, setImportUrl]       = useState('');
  const [importing, setImporting]       = useState(false);
  const [importError, setImportError]   = useState('');
  const [importResult, setImportResult] = useState(null); // { totalFetched, sourceTotal, capped }

  useEffect(() => {
    if (isEditing) {
      const fetchPlaylist = async () => {
        try {
          const { data } = await api.get(`/playlists/${id}`);
          setTitle(data.title);
          setDescription(data.description);
          if (data.videos && data.videos.length > 0) {
            setVideos(data.videos.map(v => ({ url: v.url, videoId: v.videoId, title: v.title || '' })));
          }
        } catch (err) {
          setError('Failed to load playlist for editing');
        } finally {
          setLoading(false);
        }
      };
      fetchPlaylist();
    }
  }, [id, isEditing]);

  // ── Single-video handlers (unchanged) ──────────────────────────────────────
  const handleAddRow = () => {
    setVideos([...videos, { url: '', videoId: null, title: '' }]);
  };

  const handleRemoveVideo = (index) => {
    const updated = [...videos];
    updated.splice(index, 1);
    if (updated.length === 0) updated.push({ url: '', videoId: null, title: '' });
    setVideos(updated);
  };

  const handleUrlChange = (index, value) => {
    const updated = [...videos];
    updated[index] = { ...updated[index], url: value, videoId: null };
    setVideos(updated);
  };

  // ── Import handler ─────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!importUrl.trim() || importing) return;
    setImportError('');
    setImportResult(null);
    setImporting(true);

    try {
      const { data } = await api.post('/playlists/import-yt', { playlistUrl: importUrl.trim() });

      // De-duplicate against videos already in the list
      const existingIds = new Set(videos.map(v => v.videoId).filter(Boolean));
      const newVideos = data.videos.filter(v => !existingIds.has(v.videoId));

      // Merge: remove the lone empty placeholder if present, then append
      setVideos(prev => {
        const base = prev.filter(v => v.url.trim() !== '');
        return [...base, ...newVideos];
      });

      setImportResult({ totalFetched: data.totalFetched, sourceTotal: data.sourceTotal, capped: data.capped, added: newVideos.length });
      setImportUrl('');
    } catch (err) {
      setImportError(err.response?.data?.message || 'Import failed — check the URL and try again.');
    } finally {
      setImporting(false);
    }
  };

  // ── Save handler ───────────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    const filteredUrls = videos.map(v => v.url).filter(url => url.trim() !== '');
    if (filteredUrls.length === 0) {
      setError('At least one video URL is required');
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await api.put(`/playlists/${id}`, { title, description, videoUrls: filteredUrls });
        navigate(`/playlister/${id}`);
      } else {
        const { data } = await api.post('/playlists', { title, description, videoUrls: filteredUrls });
        navigate(`/playlister/${data._id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save playlist. Ensure all links are valid YouTube URLs.');
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
    <div className="w-full max-w-3xl mx-auto px-6 py-10 sm:px-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Link to={isEditing ? `/playlister/${id}` : '/playlister'} className="text-brand-muted hover:text-brand-text transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-3xl font-medium tracking-tight text-brand-text flex items-center gap-2">
            <Video className="w-6 h-6 text-brand-line hidden sm:block" />
            {isEditing ? 'Edit Playlist' : 'Create Playlist'}
          </h1>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 mb-8 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* ── Title ─────────────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-brand-text">Playlist Title <span className="text-status-error">*</span></label>
          <input
            type="text"
            placeholder="e.g., Best React Tutorials"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-brand-surface border border-black/[0.12] rounded-[8px] text-brand-text placeholder:text-brand-faint px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-text/20 focus:border-brand-text/40 transition-colors"
          />
        </div>

        {/* ── Description ───────────────────────────────────────── */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-brand-text">Description</label>
          <textarea
            placeholder="What is this playlist about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full bg-brand-surface border border-black/[0.12] rounded-[8px] text-brand-text placeholder:text-brand-faint px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-text/20 focus:border-brand-text/40 transition-colors resize-y"
          />
        </div>

        {/* ── Import from YouTube Playlist ──────────────────────── */}
        <div className="space-y-3 pt-4 border-t border-black/[0.08]">
          <div>
            <p className="text-sm font-medium text-brand-text mb-1">Import from YouTube Playlist</p>
            <p className="text-xs text-brand-muted">Paste a YouTube playlist URL to auto-import all its videos. You can remove any before saving.</p>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={importUrl}
              onChange={(e) => { setImportUrl(e.target.value); setImportError(''); setImportResult(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleImport(); } }}
              placeholder="https://youtube.com/playlist?list=PL..."
              className="flex-1 bg-brand-surface border border-black/[0.12] rounded-[8px] text-brand-text placeholder:text-brand-faint px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-text/20 focus:border-brand-text/40 transition-colors"
            />
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !importUrl.trim()}
              className="btn-secondary shrink-0 px-4 py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin mr-1.5 inline" />Importing…</>
                : <><Download className="w-4 h-4 mr-1.5 inline" />Import</>
              }
            </button>
          </div>

          {/* Import error */}
          {importError && (
            <p className="text-xs text-status-error bg-[#fef2f2] border border-[#fca5a5] px-3 py-2 rounded-[6px]">
              {importError}
            </p>
          )}

          {/* Import success banner */}
          {importResult && (
            <div className="flex items-start gap-2 text-xs bg-[#f0fdf4] border border-[#86efac] px-3 py-2.5 rounded-[6px] text-[#166534]">
              <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Imported {importResult.added} new video{importResult.added !== 1 && 's'}.
                {importResult.capped && ` (Playlist has ${importResult.sourceTotal} total videos — only the first ${importResult.totalFetched} were imported.)`}
                {importResult.added < importResult.totalFetched && importResult.added !== importResult.totalFetched && ` ${importResult.totalFetched - importResult.added} were already in your list and were skipped.`}
              </span>
            </div>
          )}
        </div>

        {/* ── Manual video URLs ─────────────────────────────────── */}
        <div className="space-y-4 pt-4 border-t border-black/[0.08]">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-brand-text">
              YouTube Videos <span className="text-status-error">*</span>
              <span className="ml-2 text-xs font-normal text-brand-faint">({videos.filter(v => v.url.trim()).length} added)</span>
            </label>
            <button type="button" onClick={handleAddRow} className="text-xs font-medium text-brand-text hover:opacity-70 flex items-center gap-1 transition-opacity">
              <Plus className="w-3.5 h-3.5" /> Add Video
            </button>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {videos.map((vid, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="flex-1 relative min-w-0">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-brand-faint text-sm">{index + 1}.</span>
                  </div>
                  <input
                    type="text"
                    placeholder="https://youtube.com/watch?v=..."
                    value={vid.url}
                    onChange={(e) => handleUrlChange(index, e.target.value)}
                    className="w-full bg-brand-surface border border-black/[0.12] rounded-[8px] text-brand-text placeholder:text-brand-faint pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-text/20 focus:border-brand-text/40 transition-colors"
                  />
                  {/* Show imported title as a subtle subtitle */}
                  {vid.title && (
                    <p className="absolute -bottom-4 left-9 text-[10px] text-brand-faint truncate max-w-[calc(100%-2.25rem)] leading-tight">
                      {vid.title}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveVideo(index)}
                  className="p-2.5 text-brand-faint hover:text-status-error transition-colors rounded-[8px] hover:bg-status-error/10 shrink-0"
                  title="Remove video"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Actions ───────────────────────────────────────────── */}
        <div className="pt-8 flex items-center gap-4">
          <button type="submit" disabled={saving} className="btn-primary flex-1 sm:flex-none justify-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {isEditing ? 'Save Changes' : 'Create Playlist'}
          </button>
          <Link to={isEditing ? `/playlister/${id}` : '/playlister'} className="btn-secondary flex-1 sm:flex-none justify-center">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
