import React, { useState, useEffect, useContext, useRef } from 'react';
import axios from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import {
  Plus, Trash2, Loader2, MessageSquare, AlertTriangle, X,
  Camera, CheckCircle2, Pencil, Github, Linkedin, Globe
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';

// ─── Avatar placeholder ────────────────────────────────────────────────────────
const AvatarPlaceholder = ({ name, size = 72 }) => {
  const initials = (name || '?')
    .split(' ')
    .map(w => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <div
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className="rounded-full bg-brand-surface-2 border border-black/[0.08] flex items-center justify-center font-medium text-brand-muted select-none shrink-0"
    >
      {initials}
    </div>
  );
};

// ─── Allowed image types / max size ───────────────────────────────────────────
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_MB   = 4;
const MAX_SIZE_B    = MAX_SIZE_MB * 1024 * 1024;

const Dashboard = () => {
  const { user, setUser, logout } = useContext(AuthContext);
  const chatCtx      = useChat();
  const totalUnread  = chatCtx?.totalUnread ?? 0;
  const navigate     = useNavigate();
  const fileInputRef = useRef(null);

  // ── Data state ──
  const [skills, setSkills]         = useState([]);
  const [allSkills, setAllSkills]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [pageError, setPageError]   = useState('');

  // ── Edit mode state ──
  const [isEditing, setIsEditing]   = useState(false);
  const [editForm, setEditForm]     = useState({ 
    name: '', username: '', bio: '', 
    isAvailable: true, github: '', linkedin: '', website: '' 
  });
  const [saving, setSaving]         = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Avatar upload state ──
  const [avatarPreview, setAvatarPreview] = useState(null);   // object URL
  const [avatarFile, setAvatarFile]       = useState(null);   // File object
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError]     = useState('');

  // ── Skill state ──
  const [skillType, setSkillType]   = useState('teach');
  const [skillLevel, setSkillLevel] = useState('Beginner');
  const [skillSearch, setSkillSearch] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredSkills, setFilteredSkills]   = useState([]);
  const [suggestedSkills, setSuggestedSkills] = useState([]);
  const [isSearching, setIsSearching]         = useState(false);

  // ── Delete account state ──
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword]   = useState('');
  const [deleteError, setDeleteError]         = useState('');
  const [deleting, setDeleting]               = useState(false);

  // ── Initial data fetch ──
  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [userSkillsRes, allSkillsRes] = await Promise.all([
        axios.get('/users/skills'),
        axios.get('/skills'),
      ]);
      setSkills(userSkillsRes.data);
      setAllSkills(allSkillsRes.data);
    } catch {
      setPageError('Failed to load skills. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  // ── Open edit mode ──
  const openEdit = () => {
    setEditForm({
      name:        user?.name     || '',
      username:    user?.username || '',
      bio:         user?.bio      || '',
      isAvailable: user?.isAvailable ?? true,
      github:      user?.socialLinks?.github   || '',
      linkedin:    user?.socialLinks?.linkedin || '',
      website:     user?.socialLinks?.website  || '',
    });
    setAvatarPreview(null);
    setAvatarFile(null);
    setAvatarError('');
    setPageError('');
    setSaveSuccess(false);
    setIsEditing(true);
  };

  // ── Cancel edit ──
  const cancelEdit = () => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(null);
    setAvatarFile(null);
    setAvatarError('');
    setIsEditing(false);
  };

  // ── Avatar file selection ──
  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');

    if (!ALLOWED_TYPES.includes(file.type)) {
      setAvatarError('Please choose a JPEG, PNG, WebP, or GIF image.');
      return;
    }
    if (file.size > MAX_SIZE_B) {
      setAvatarError(`Image must be smaller than ${MAX_SIZE_MB} MB.`);
      return;
    }

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarFile(file);
    // Clear the file input so the same file can be re-selected if needed
    e.target.value = '';
  };

  // ── Upload avatar — resize + compress in-browser, store as data URL ──────────
  // No external storage service exists in this project. We resize the image to
  // max 256×256 px and compress it to JPEG at 82 % quality using a canvas.
  // The resulting data URL is typically 15–40 KB — well within the 10 MB server
  // body limit we set. No third-party upload service required.
  const uploadAvatar = async () => {
    if (!avatarFile) return user?.avatarUrl || '';

    setAvatarUploading(true);
    setAvatarError('');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const MAX = 256;
          let { width, height } = img;
          if (width > MAX || height > MAX) {
            if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
            else                { width  = Math.round((width  * MAX) / height); height = MAX; }
          }
          const canvas = document.createElement('canvas');
          canvas.width  = width;
          canvas.height = height;
          canvas.getContext('2d').drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(avatarFile);
      });
      return dataUrl;
    } catch {
      setAvatarError('Failed to process image. Please try again.');
      return user?.avatarUrl || '';
    } finally {
      setAvatarUploading(false);
    }
  };

  // ── Save profile ──
  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    setPageError('');
    setAvatarError('');

    // Validate name
    if (!editForm.name.trim() || editForm.name.trim().length < 2) {
      setPageError('Name must be at least 2 characters.');
      setSaving(false);
      return;
    }
    if (!editForm.username.trim() || editForm.username.trim().length < 3) {
      setPageError('Username must be at least 3 characters.');
      setSaving(false);
      return;
    }

    try {
      // 1. Upload avatar if a new file was chosen
      let avatarUrl = user?.avatarUrl || '';
      if (avatarFile) {
        avatarUrl = await uploadAvatar();
      }

      // 2. Save profile fields
      const payload = {
        name:        editForm.name.trim(),
        username:    editForm.username.trim(),
        bio:         editForm.bio.trim(),
        avatarUrl,
        isAvailable: editForm.isAvailable,
        socialLinks: {
          github:   editForm.github.trim(),
          linkedin: editForm.linkedin.trim(),
          website:  editForm.website.trim(),
        }
      };
      const { data } = await axios.put('/users/profile', payload);
      setUser(data);
      setSaveSuccess(true);
      setIsEditing(false);

      // Clean up preview URL
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      setAvatarPreview(null);
      setAvatarFile(null);
    } catch (error) {
      setPageError(error.response?.data?.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async () => {
    try {
      const { data } = await axios.put('/users/profile', { isAvailable: !(user?.isAvailable ?? true) });
      setUser(data);
    } catch (error) {
      setPageError('Failed to update availability.');
    }
  };

  // ── Skill search debounce ──
  useEffect(() => {
    if (skillSearch.trim().length < 2) {
      setFilteredSkills([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const controller = new AbortController();

    const fetchSkills = async () => {
      try {
        const res = await axios.get(`/skills/search?q=${encodeURIComponent(skillSearch)}`, {
          signal: controller.signal,
        });
        const results = res.data.filter(
          s => !skills.some(us => us.skillId?.name?.toLowerCase() === s.name.toLowerCase())
        );
        setFilteredSkills(results);
      } catch (error) {
        if (!axios.isCancel(error)) {
          setFilteredSkills([]);
        }
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(fetchSkills, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [skillSearch, skills]);

  useEffect(() => {
    const available = allSkills.filter(s =>
      !skills.some(us => us.skillId?._id === s._id || us.skillId?.name === s.name)
    );
    setSuggestedSkills(available.slice(0, 5));
  }, [allSkills, skills]);

  const handleAddSkill = async (skillObj) => {
    setPageError('');
    try {
      const res = await axios.post('/skills', { name: skillObj.name });
      const finalSkillId = res.data._id;
      await axios.post('/users/skills', { skillId: finalSkillId, type: skillType, level: skillLevel });
      fetchData();
    } catch (error) {
      setPageError(error.response?.data?.message || 'Failed to add skill.');
    }
  };

  const handleRemoveSkill = async (id) => {
    setPageError('');
    try {
      await axios.delete(`/users/skills/${id}`);
      fetchData();
    } catch (error) {
      setPageError(error.response?.data?.message || 'Failed to remove skill.');
    }
  };

  const handleDeleteAccount = async (e) => {
    e.preventDefault();
    setDeleteError('');
    setDeleting(true);
    try {
      await axios.delete('/users/me', { data: { password: deletePassword } });
      await logout();
      navigate('/', { replace: true });
    } catch (error) {
      setDeleteError(error.response?.data?.message || 'Failed to delete account.');
      setDeleting(false);
    }
  };

  const teachSkills = skills.filter(s => s.type === 'teach');
  const learnSkills = skills.filter(s => s.type === 'learn');

  if (loading) return (
    <div className="loading-page">
      <Loader2 className="w-6 h-6 animate-spin text-brand-text" />
      <span className="ml-3 text-sm text-brand-muted">Loading…</span>
    </div>
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-6 py-10 sm:px-8">

      <h1 className="text-3xl font-medium tracking-tight text-brand-text mb-8">Profile</h1>

      {/* Global error / success banners */}
      {pageError && (
        <div className="mb-6 px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
          {pageError}
        </div>
      )}
      {saveSuccess && (
        <div className="mb-6 px-4 py-3 text-sm text-status-success bg-green-50 border border-green-200 rounded-[8px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          Profile saved successfully.
        </div>
      )}

      {/* Unread messages banner */}
      {totalUnread > 0 && (
        <Link
          to="/conversations"
          className="flex items-center gap-3 mb-6 px-4 py-3 text-sm bg-brand-surface-2 border border-black/[0.08] rounded-[8px] hover:border-black/[0.16] transition-colors"
        >
          <MessageSquare className="w-4 h-4 shrink-0 text-brand-text" />
          <span className="text-brand-text">
            You have <strong>{totalUnread}</strong> unread message{totalUnread !== 1 ? 's' : ''}.
          </span>
          <span className="ml-auto text-brand-muted text-xs">View →</span>
        </Link>
      )}

      {/* ── Profile card ──────────────────────────────────────────────────── */}
      <div className="card card-body mb-6">
        {isEditing ? (
          /* ── Edit mode ── */
          <div>
            <h2 className="text-base font-medium text-brand-text mb-5">Edit Profile</h2>

            {/* Avatar upload */}
            <div className="flex items-center gap-5 mb-6">
              <div className="relative shrink-0">
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    alt="Preview"
                    className="w-[72px] h-[72px] rounded-full object-cover border border-black/[0.08]"
                  />
                ) : user?.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.name}
                    className="w-[72px] h-[72px] rounded-full object-cover border border-black/[0.08]"
                    onError={e => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <AvatarPlaceholder name={editForm.name || user?.name} />
                )}
                {/* Overlay button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 hover:opacity-100 transition-opacity"
                  aria-label="Change photo"
                >
                  <Camera className="w-5 h-5 text-white" />
                </button>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary text-xs px-3 py-1.5"
                  disabled={avatarUploading}
                >
                  {avatarUploading ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…</>
                  ) : (
                    avatarFile ? 'Change photo' : 'Upload photo'
                  )}
                </button>
                {avatarFile && (
                  <button
                    type="button"
                    onClick={() => {
                      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
                      setAvatarPreview(null);
                      setAvatarFile(null);
                      setAvatarError('');
                    }}
                    className="ml-2 text-xs text-brand-muted hover:text-status-error transition-colors"
                  >
                    Remove
                  </button>
                )}
                <p className="text-xs text-brand-faint mt-1.5">
                  JPEG, PNG, WebP or GIF — max {MAX_SIZE_MB} MB
                </p>
                {avatarError && (
                  <p className="text-xs text-status-error mt-1">{avatarError}</p>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED_TYPES.join(',')}
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="input-label">Full name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="input-field"
                maxLength={60}
              />
            </div>

            {/* Username */}
            <div className="mb-4">
              <label className="input-label">Username</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-faint text-sm select-none">@</span>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={e => setEditForm(f => ({ ...f, username: e.target.value }))}
                  className="input-field pl-7"
                  maxLength={30}
                />
              </div>
            </div>

            {/* Bio */}
            <div className="mb-5">
              <label className="input-label">
                Bio
                <span className="ml-2 text-brand-faint font-normal">{editForm.bio.length}/500</span>
              </label>
              <textarea
                className="input-field resize-none"
                rows={3}
                value={editForm.bio}
                onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))}
                maxLength={500}
                placeholder="Tell others about yourself and what you'd like to learn or teach…"
              />
            </div>

            {/* Social Links */}
            <div className="mb-5">
              <label className="input-label mb-2">Social / Portfolio Links</label>
              <div className="flex flex-col gap-3">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted"><Github className="w-4 h-4" /></span>
                  <input
                    type="url"
                    placeholder="GitHub URL"
                    value={editForm.github}
                    onChange={e => setEditForm(f => ({ ...f, github: e.target.value }))}
                    className="input-field pl-9"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted"><Linkedin className="w-4 h-4" /></span>
                  <input
                    type="url"
                    placeholder="LinkedIn URL"
                    value={editForm.linkedin}
                    onChange={e => setEditForm(f => ({ ...f, linkedin: e.target.value }))}
                    className="input-field pl-9"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-muted"><Globe className="w-4 h-4" /></span>
                  <input
                    type="url"
                    placeholder="Personal Website URL"
                    value={editForm.website}
                    onChange={e => setEditForm(f => ({ ...f, website: e.target.value }))}
                    className="input-field pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Availability */}
            <div className="mb-6 flex items-center justify-between p-3 border border-black/[0.08] rounded-[8px] bg-brand-surface-2">
              <div>
                <p className="text-sm font-medium text-brand-text">Availability Status</p>
                <p className="text-xs text-brand-muted">Are you currently accepting new skill exchange requests?</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={editForm.isAvailable}
                  onChange={e => setEditForm(f => ({ ...f, isAvailable: e.target.checked }))}
                />
                <div className="w-11 h-6 bg-black/[0.12] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-status-success"></div>
              </label>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={cancelEdit}
                disabled={saving || avatarUploading}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || avatarUploading}
                className="btn-primary min-w-[120px]"
              >
                {(saving || avatarUploading) && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving || avatarUploading ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <div className="flex items-start gap-4">
            {/* Avatar */}
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="w-[72px] h-[72px] rounded-full object-cover border border-black/[0.08] shrink-0"
                onError={e => { e.target.style.display = 'none'; }}
              />
            ) : (
              <AvatarPlaceholder name={user?.name} />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-medium text-brand-text">{user.name}</h2>
                    {/* Availability Toggle */}
                    <button
                      onClick={handleToggleAvailability}
                      className="flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border bg-brand-surface border-black/[0.08] text-brand-muted hover:bg-black/[0.02] transition-colors"
                      title="Toggle availability"
                    >
                      <span>{user?.isAvailable !== false ? '🟢' : '🔴'}</span>
                      {user?.isAvailable !== false ? 'Available for Skill Exchange' : 'Not Accepting New Requests'}
                    </button>
                  </div>
                  <p className="text-sm text-brand-muted mt-0.5">@{user.username}</p>
                </div>
                <button
                  onClick={openEdit}
                  className="flex items-center gap-1.5 text-sm text-brand-muted hover:text-brand-text transition-colors border border-black/[0.12] hover:border-black/[0.24] px-3 py-1.5 rounded-full shrink-0"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Edit profile
                </button>
              </div>
              <p className="text-sm text-brand-muted mt-3 leading-relaxed">
                {user.bio || <span className="italic text-brand-faint">No bio yet.</span>}
              </p>
              
              {/* Social Icons */}
              {(user?.socialLinks?.github || user?.socialLinks?.linkedin || user?.socialLinks?.website) && (
                <div className="flex items-center gap-3 mt-4">
                  {user.socialLinks.github && (
                    <a href={user.socialLinks.github} target="_blank" rel="noopener noreferrer" className="p-1.5 text-brand-muted hover:text-brand-text hover:bg-black/[0.04] rounded-full transition-colors border border-transparent hover:border-black/[0.08]">
                      <Github className="w-4 h-4" />
                    </a>
                  )}
                  {user.socialLinks.linkedin && (
                    <a href={user.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="p-1.5 text-brand-muted hover:text-brand-text hover:bg-black/[0.04] rounded-full transition-colors border border-transparent hover:border-black/[0.08]">
                      <Linkedin className="w-4 h-4" />
                    </a>
                  )}
                  {user.socialLinks.website && (
                    <a href={user.socialLinks.website} target="_blank" rel="noopener noreferrer" className="p-1.5 text-brand-muted hover:text-brand-text hover:bg-black/[0.04] rounded-full transition-colors border border-transparent hover:border-black/[0.08]">
                      <Globe className="w-4 h-4" />
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Skills grid ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        {/* Teach */}
        <div className="card card-body">
          <h3 className="text-sm font-medium text-brand-text mb-4 pb-3 border-b border-black/[0.06]">
            Skills I can teach
          </h3>
          {teachSkills.length === 0 ? (
            <p className="text-sm text-brand-faint italic">None added yet.</p>
          ) : (
            <ul className="space-y-2">
              {teachSkills.map(skill => (
                <li
                  key={skill._id}
                  className="flex justify-between items-center px-3 py-2 bg-brand-surface-2 rounded-[8px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-brand-text">{skill.skillId?.name}</span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-brand-surface border border-black/[0.08] text-brand-muted rounded-full">
                      {skill.level || 'Beginner'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveSkill(skill._id)}
                    className="text-brand-faint hover:text-status-error transition-colors p-1"
                    aria-label="Remove skill"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Learn */}
        <div className="card card-body">
          <h3 className="text-sm font-medium text-brand-text mb-4 pb-3 border-b border-black/[0.06]">
            Skills I want to learn
          </h3>
          {learnSkills.length === 0 ? (
            <p className="text-sm text-brand-faint italic">None added yet.</p>
          ) : (
            <ul className="space-y-2">
              {learnSkills.map(skill => (
                <li
                  key={skill._id}
                  className="flex justify-between items-center px-3 py-2 bg-brand-surface-2 rounded-[8px]"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-brand-text">{skill.skillId?.name}</span>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-brand-surface border border-black/[0.08] text-brand-muted rounded-full">
                      {skill.level || 'Beginner'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveSkill(skill._id)}
                    className="text-brand-faint hover:text-status-error transition-colors p-1"
                    aria-label="Remove skill"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Add Skill ──────────────────────────────────────────────────────── */}
      <div className="card card-body mb-6 relative">
        <h3 className="text-sm font-medium text-brand-text mb-4">Add a skill</h3>
        <div className="flex flex-col sm:flex-row gap-3 items-start">
          <div className="flex-1 w-full relative">
            <label className="input-label">Search skills</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-4 w-4 text-brand-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="e.g. Project Management"
                value={skillSearch}
                onChange={e => { setSkillSearch(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
                className="input-field pl-10"
              />
            </div>

            {/* Dropdown */}
            {showSuggestions && skillSearch.trim().length >= 2 && (
              <div className="absolute z-10 mt-1 w-full bg-brand-surface border border-black/[0.08] rounded-[8px] shadow-lg max-h-60 overflow-y-auto">
                {isSearching ? (
                  <div className="px-4 py-3 text-sm text-brand-muted flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                  </div>
                ) : filteredSkills.length > 0 ? (
                  <ul className="py-1">
                    {filteredSkills.map(s => (
                      <li
                        key={s.id || s._id}
                        className="px-4 py-2 hover:bg-brand-surface-2 cursor-pointer text-sm text-brand-text transition-colors"
                        onClick={() => {
                          handleAddSkill(s);
                          setSkillSearch('');
                          setShowSuggestions(false);
                        }}
                      >
                        {s.name}
                        {s.category && <span className="text-brand-faint text-xs ml-2">({s.category})</span>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-4 py-3 text-sm text-brand-muted">No skills found. Try a different search.</div>
                )}
              </div>
            )}
          </div>

          <div className="w-full sm:w-44">
            <label className="input-label">Type</label>
            <select
              value={skillType}
              onChange={e => setSkillType(e.target.value)}
              className="input-field"
            >
              <option value="teach">I can teach</option>
              <option value="learn">I want to learn</option>
            </select>
          </div>

          <div className="w-full sm:w-44">
            <label className="input-label">Proficiency Level</label>
            <select
              value={skillLevel}
              onChange={e => setSkillLevel(e.target.value)}
              className="input-field"
            >
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Expert">Expert</option>
            </select>
          </div>
        </div>

        {/* Suggested skills */}
        {suggestedSkills.length > 0 && (
          <div className="mt-5">
            <h4 className="text-sm font-medium text-brand-text mb-3">Suggested skills</h4>
            <div className="flex flex-wrap gap-2">
              {suggestedSkills.map(s => (
                <button
                  key={s._id}
                  onClick={() => handleAddSkill(s)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-black/[0.08] hover:border-black/[0.16] hover:bg-brand-surface-2 transition-colors text-sm text-brand-text"
                >
                  {s.name} <Plus className="w-3.5 h-3.5 text-brand-muted" />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Danger Zone ────────────────────────────────────────────────────── */}
      <div className="card card-body border-status-error/20">
        <h3 className="text-sm font-medium text-status-error mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Danger Zone
        </h3>
        <p className="text-sm text-brand-muted mb-4">
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        <button
          onClick={() => { setShowDeleteModal(true); setDeleteError(''); setDeletePassword(''); }}
          className="text-sm font-medium text-status-error border border-status-error/30 hover:bg-status-error/5 px-4 py-2 rounded-full transition-colors"
        >
          Delete account
        </button>
      </div>

      {/* ── Delete Confirmation Modal ───────────────────────────────────────── */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-brand-surface border border-black/[0.10] rounded-[8px] shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.06]">
              <h3 className="text-sm font-medium text-brand-text flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-status-error" />
                Delete account
              </h3>
              <button
                onClick={() => !deleting && setShowDeleteModal(false)}
                disabled={deleting}
                className="text-brand-faint hover:text-brand-text transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              <div className="px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px] mb-5">
                <p className="font-medium mb-0.5">This action is permanent.</p>
                <p className="text-xs leading-relaxed text-status-error/80">
                  All profile data, skills, exchange requests, and message history will be deleted immediately.
                </p>
              </div>

              {deleteError && (
                <div className="mb-4 px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
                  {deleteError}
                </div>
              )}

              <form onSubmit={handleDeleteAccount}>
                <label className="input-label">Enter your password to confirm</label>
                <input
                  type="password"
                  required
                  value={deletePassword}
                  onChange={e => setDeletePassword(e.target.value)}
                  className="input-field mb-5"
                  placeholder="Password"
                  disabled={deleting}
                />
                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowDeleteModal(false)}
                    disabled={deleting}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!deletePassword || deleting}
                    className="btn-danger min-w-[140px]"
                  >
                    {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {deleting ? 'Deleting…' : 'Delete my account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
