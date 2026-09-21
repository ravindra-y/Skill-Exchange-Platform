import React, { useState, useEffect } from 'react';
import { X, Loader2 } from 'lucide-react';
import axios from '../api/axios';

const ProposeSwapModal = ({ targetUser, teachSkills, onClose, onSubmit }) => {
  const [myTeachSkills, setMyTeachSkills] = useState([]);
  const [loadingSkills, setLoadingSkills] = useState(true);
  
  const [selectedLearnSkillId, setSelectedLearnSkillId] = useState('');
  const [selectedOfferSkillId, setSelectedOfferSkillId] = useState('');
  const [proposedDate, setProposedDate] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMySkills = async () => {
      try {
        const { data } = await axios.get('/users/skills');
        const teach = data.filter(s => s.type === 'teach').map(s => ({
          id: s.skillId._id,
          name: s.skillId.name
        }));
        setMyTeachSkills(teach);
        if (teach.length > 0) setSelectedOfferSkillId(teach[0].id);
      } catch (err) {
        console.error('Failed to load my skills', err);
      } finally {
        setLoadingSkills(false);
      }
    };
    fetchMySkills();
    
    if (teachSkills?.length > 0) {
      setSelectedLearnSkillId(teachSkills[0].id);
    }
  }, [teachSkills]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLearnSkillId || !selectedOfferSkillId) {
      setError('Please select both skills to proceed.');
      return;
    }

    setSubmitting(true);
    setError('');
    
    try {
      const payload = {
        receiverId: targetUser._id,
        requestedSkillId: selectedLearnSkillId,
        offeredSkillId: selectedOfferSkillId,
        proposedDate: proposedDate ? new Date(proposedDate).toISOString() : undefined,
        message
      };
      
      const { data } = await axios.post('/exchange', payload);
      onSubmit(data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send request. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
        <div className="flex justify-between items-center px-6 py-4 border-b border-black/[0.08]">
          <h2 className="text-lg font-medium text-brand-text">Propose Skill Swap</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-black/[0.05] transition-colors text-brand-muted">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
              {error}
            </div>
          )}
          
          <p className="text-sm text-brand-muted mb-6">
            Propose a session to <strong>{targetUser.name}</strong>. Let them know what you'd like to learn and what you can offer in return.
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">I want to learn:</label>
              <select 
                value={selectedLearnSkillId}
                onChange={(e) => setSelectedLearnSkillId(e.target.value)}
                className="w-full text-sm rounded-[8px] border-black/[0.12] bg-brand-surface-2 focus:border-brand-text focus:ring-1 focus:ring-brand-text py-2 px-3"
                required
              >
                <option value="" disabled>Select a skill...</option>
                {teachSkills?.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">I will teach in return:</label>
              {loadingSkills ? (
                <div className="flex items-center text-sm text-brand-muted py-2"><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading your skills...</div>
              ) : (
                <select 
                  value={selectedOfferSkillId}
                  onChange={(e) => setSelectedOfferSkillId(e.target.value)}
                  className="w-full text-sm rounded-[8px] border-black/[0.12] bg-brand-surface-2 focus:border-brand-text focus:ring-1 focus:ring-brand-text py-2 px-3"
                  required
                >
                  <option value="" disabled>Select your skill...</option>
                  {myTeachSkills.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              {(!loadingSkills && myTeachSkills.length === 0) && (
                <p className="text-xs text-status-error mt-1">You haven't added any teach skills to your profile.</p>
              )}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Preferred Date & Time (optional):</label>
              <input 
                type="datetime-local" 
                value={proposedDate}
                onChange={(e) => setProposedDate(e.target.value)}
                className="w-full text-sm rounded-[8px] border-black/[0.12] bg-brand-surface-2 focus:border-brand-text focus:ring-1 focus:ring-brand-text py-2 px-3"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-brand-text mb-1.5">Message / Agenda (optional):</label>
              <textarea 
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Hi! I'd love to learn about..."
                className="w-full text-sm rounded-[8px] border-black/[0.12] bg-brand-surface-2 focus:border-brand-text focus:ring-1 focus:ring-brand-text py-2 px-3 resize-none"
              ></textarea>
            </div>
          </div>
          
          <div className="mt-8 pt-4 flex justify-end gap-3 border-t border-black/[0.08]">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium text-brand-text hover:bg-black/[0.02] rounded-full transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (myTeachSkills.length === 0)}
              className="px-5 py-2 text-sm font-medium text-brand-bg bg-brand-text hover:brightness-110 rounded-full transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</> : 'Send Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProposeSwapModal;
