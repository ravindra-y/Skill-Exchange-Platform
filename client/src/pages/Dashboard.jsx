import React, { useState, useEffect, useContext } from 'react';
import axios from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { Plus, Trash2, Loader2, MessageSquare, AlertTriangle, X, User as UserIcon } from 'lucide-react';
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
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      <span className="ml-3 text-gray-600 font-medium">Loading dashboard…</span>
    </div>
  );

  return (
    <div className="page-container">
      <h1 className="page-title">
        <UserIcon className="w-8 h-8 text-indigo-600" />
        Dashboard
      </h1>

      {/* Error banner */}
      {pageError && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {pageError}
        </div>
      )}

      {/* Unread messages banner */}
      {totalUnread > 0 && (
        <Link
          to="/conversations"
          className="flex items-center gap-3 mb-6 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-lg px-4 py-3 text-sm hover:bg-indigo-100 transition shadow-sm"
        >
          <MessageSquare className="w-4 h-4 shrink-0" />
          <span>
            You have <strong>{totalUnread}</strong> unread message{totalUnread !== 1 ? 's' : ''}.
          </span>
          <span className="ml-auto text-indigo-600 font-medium">View →</span>
        </Link>
      )}

      <div className="card mb-8">
        <div className="card-body">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
              <p className="text-gray-500">@{user.username}</p>
            </div>
            <button 
              onClick={() => setIsEditing(!isEditing)}
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium transition"
            >
              {isEditing ? 'Cancel' : 'Edit Profile'}
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
                {saving ? 'Saving…' : 'Save Bio'}
              </button>
            </div>
          ) : (
            <p className="text-gray-700 mt-2">{user.bio || 'No bio provided yet.'}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Teach Skills */}
        <div className="card">
          <div className="card-body">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-2">Skills I can teach</h3>
            {teachSkills.length === 0 ? (
              <div className="empty-state py-8">
                <span className="empty-state-text text-sm">None added yet.</span>
              </div>
            ) : (
              <ul className="space-y-3">
                {teachSkills.map(skill => (
                  <li key={skill._id} className="flex justify-between items-center bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg">
                    <span className="font-medium text-gray-800">{skill.skillId.name}</span>
                    <button onClick={() => handleRemoveSkill(skill._id)} className="text-gray-400 hover:text-red-600 transition p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Learn Skills */}
        <div className="card">
          <div className="card-body">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-2">Skills I want to learn</h3>
            {learnSkills.length === 0 ? (
              <div className="empty-state py-8">
                <span className="empty-state-text text-sm">None added yet.</span>
              </div>
            ) : (
              <ul className="space-y-3">
                {learnSkills.map(skill => (
                  <li key={skill._id} className="flex justify-between items-center bg-gray-50 border border-gray-100 px-3 py-2 rounded-lg">
                    <span className="font-medium text-gray-800">{skill.skillId.name}</span>
                    <button onClick={() => handleRemoveSkill(skill._id)} className="text-gray-400 hover:text-red-600 transition p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Add Skill Form */}
      <div className="card mb-8">
        <div className="card-body">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add a new skill</h3>
          <form onSubmit={handleAddSkill} className="flex flex-col sm:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="input-label">Select Skill</label>
              <select
                required
                value={selectedSkill}
                onChange={(e) => setSelectedSkill(e.target.value)}
                className="input-field"
              >
                <option value="">-- Select a skill --</option>
                {allSkills.map(s => (
                  <option key={s._id} value={s._id}>{s.name} ({s.category})</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-48">
              <label className="input-label">Type</label>
              <select
                value={skillType}
                onChange={(e) => setSkillType(e.target.value)}
                className="input-field"
              >
                <option value="teach">I can teach this</option>
                <option value="learn">I want to learn this</option>
              </select>
            </div>
            <button type="submit" className="btn-primary w-full sm:w-auto h-[42px]">
              <Plus className="w-4 h-4" /> Add
            </button>
          </form>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-red-50 shadow-sm rounded-xl p-6 border border-red-200">
        <h3 className="text-lg font-semibold text-red-700 mb-2 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" /> Danger Zone
        </h3>
        <p className="text-red-600/80 text-sm mb-4">
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        <button
          onClick={() => {
            setShowDeleteModal(true);
            setDeleteError('');
            setDeletePassword('');
          }}
          className="btn-danger"
        >
          Delete Account
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Delete Account
              </h3>
              <button
                onClick={() => !deleting && setShowDeleteModal(false)}
                className="text-gray-400 hover:text-gray-600 transition p-1"
                disabled={deleting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="bg-red-50 text-red-700 text-sm p-4 rounded-lg mb-6 border border-red-100">
                <p className="font-semibold mb-1">Warning: This action is permanent.</p>
                <p>All your profile data, skills, exchange requests, and message history will be immediately deleted.</p>
              </div>

              {deleteError && (
                <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                  {deleteError}
                </div>
              )}

              <form onSubmit={handleDeleteAccount}>
                <label className="input-label">
                  Enter your password to confirm
                </label>
                <input
                  type="password"
                  required
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="input-field mb-6"
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
