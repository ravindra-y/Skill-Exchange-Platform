import React, { useState, useEffect, useContext } from 'react';
import axios from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { Plus, Trash2, Loader2 } from 'lucide-react';

const Dashboard = () => {
  const { user, setUser } = useContext(AuthContext);
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

  const teachSkills = skills.filter(s => s.type === 'teach');
  const learnSkills = skills.filter(s => s.type === 'learn');

  if (loading) return (
    <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      <span className="ml-3 text-gray-600">Loading dashboard…</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>

      {/* Error banner */}
      {pageError && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {pageError}
        </div>
      )}
      <div className="bg-white shadow rounded-lg p-6 mb-8 border border-gray-100">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{user.name}</h2>
            <p className="text-gray-500">@{user.username}</p>
          </div>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
          >
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>
        
        {isEditing ? (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700">Bio</label>
            <textarea
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              rows="3"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
            <button
              onClick={handleUpdateProfile}
              disabled={saving}
              className="mt-2 flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              {saving ? 'Saving…' : 'Save Bio'}
            </button>
          </div>
        ) : (
          <p className="text-gray-700 mt-2">{user.bio || 'No bio provided yet.'}</p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Teach Skills */}
        <div className="bg-white shadow rounded-lg p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Skills I can teach</h3>
          <ul className="space-y-3 mb-6">
            {teachSkills.length === 0 ? (
              <li className="text-gray-500 text-sm">None added yet.</li>
            ) : (
              teachSkills.map(skill => (
                <li key={skill._id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                  <span className="font-medium text-gray-800">{skill.skillId.name}</span>
                  <button onClick={() => handleRemoveSkill(skill._id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>

        {/* Learn Skills */}
        <div className="bg-white shadow rounded-lg p-6 border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 border-b pb-2">Skills I want to learn</h3>
          <ul className="space-y-3 mb-6">
            {learnSkills.length === 0 ? (
              <li className="text-gray-500 text-sm">None added yet.</li>
            ) : (
              learnSkills.map(skill => (
                <li key={skill._id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                  <span className="font-medium text-gray-800">{skill.skillId.name}</span>
                  <button onClick={() => handleRemoveSkill(skill._id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {/* Add Skill Form */}
      <div className="bg-white shadow rounded-lg p-6 mt-8 border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add a new skill</h3>
        <form onSubmit={handleAddSkill} className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Skill</label>
            <select
              required
              value={selectedSkill}
              onChange={(e) => setSelectedSkill(e.target.value)}
              className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="">-- Select a skill --</option>
              {allSkills.map(s => (
                <option key={s._id} value={s._id}>{s.name} ({s.category})</option>
              ))}
            </select>
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={skillType}
              onChange={(e) => setSkillType(e.target.value)}
              className="block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            >
              <option value="teach">I can teach this</option>
              <option value="learn">I want to learn this</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-md font-medium hover:bg-indigo-700 flex items-center justify-center"
          >
            <Plus className="w-4 h-4 mr-1" /> Add
          </button>
        </form>
      </div>
    </div>
  );
};

export default Dashboard;
