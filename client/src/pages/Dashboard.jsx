import React, { useState, useEffect, useContext } from 'react';
import axios from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { Plus, Trash2, Loader2, MessageSquare, AlertTriangle, X } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';

const Dashboard = () => {
  const { user, setUser, logout } = useContext(AuthContext);
  const chatCtx = useChat();
  const totalUnread = chatCtx?.totalUnread ?? 0;
  const navigate = useNavigate();
  const [skills, setSkills]         = useState([]);
  const [allSkills, setAllSkills]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [skillType, setSkillType]   = useState('teach');
  const [pageError, setPageError]   = useState('');
  const [saving, setSaving]         = useState(false);

  // Profile edit state
  const [isEditing, setIsEditing]   = useState(false);
  const [bio, setBio]               = useState(user?.bio || '');

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword]   = useState('');
  const [deleteError, setDeleteError]         = useState('');
  const [deleting, setDeleting]               = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [userSkillsRes, allSkillsRes] = await Promise.all([
        axios.get('/users/skills'),
        axios.get('/skills')
      ]);
      setSkills(userSkillsRes.data);
      setAllSkills(allSkillsRes.data);
    } catch (error) {
      setPageError('Failed to load skills. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async () => {
    setSaving(true);
    setPageError('');
    try {
      const { data } = await axios.put('/users/profile', { bio });
      setUser(data);
      setIsEditing(false);
    } catch (error) {
      setPageError(error.response?.data?.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSkill = async (e) => {
    e.preventDefault();
    if (!selectedSkill) return;
    setPageError('');
    try {
      await axios.post('/users/skills', { skillId: selectedSkill, type: skillType });
      setSelectedSkill('');
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

      {/* Error banner */}
      {pageError && (
        <div className="mb-6 px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
          {pageError}
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

      {/* Profile card */}
      <div className="card card-body mb-6">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h2 className="text-lg font-medium text-brand-text">{user.name}</h2>
            <p className="text-sm text-brand-muted">@{user.username}</p>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="text-sm text-brand-muted underline underline-offset-2 hover:text-brand-text transition-colors"
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {isEditing ? (
          <div className="mt-4">
            <label className="input-label">Bio</label>
            <textarea
              className="input-field"
              rows="3"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <button
              onClick={handleUpdateProfile}
              disabled={saving}
              className="btn-primary mt-3"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save bio'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-brand-muted mt-2 leading-relaxed">
            {user.bio || 'No bio yet.'}
          </p>
        )}
      </div>

      {/* Skills grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
        {/* Teach Skills */}
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
                  <span className="text-sm font-medium text-brand-text">{skill.skillId.name}</span>
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

        {/* Learn Skills */}
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
                  <span className="text-sm font-medium text-brand-text">{skill.skillId.name}</span>
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

      {/* Add Skill Form */}
      <div className="card card-body mb-6">
        <h3 className="text-sm font-medium text-brand-text mb-4">Add a skill</h3>
        <form onSubmit={handleAddSkill} className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <label className="input-label">Skill</label>
            <select
              required
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="input-field"
            >
              <option value="">— Select a skill —</option>
              {allSkills.map(s => (
                <option key={s._id} value={s._id}>{s.name} ({s.category})</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-44">
            <label className="input-label">Type</label>
            <select
              value={skillType}
              onChange={(e) => setSkillType(e.target.value)}
              className="input-field"
            >
              <option value="teach">I can teach</option>
              <option value="learn">I want to learn</option>
            </select>
          </div>
          <button type="submit" className="btn-primary w-full sm:w-auto shrink-0">
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="card card-body border-status-error/20">
        <h3 className="text-sm font-medium text-status-error mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Danger Zone
        </h3>
        <p className="text-sm text-brand-muted mb-4">
          Permanently delete your account and all associated data. This cannot be undone.
        </p>
        <button
          onClick={() => {
            setShowDeleteModal(true);
            setDeleteError('');
            setDeletePassword('');
          }}
          className="text-sm font-medium text-status-error border border-status-error/30 hover:bg-status-error/5 px-4 py-2 rounded-full transition-colors"
        >
          Delete account
        </button>
      </div>

      {/* Delete Confirmation Modal */}
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
                  onChange={(e) => setDeletePassword(e.target.value)}
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
