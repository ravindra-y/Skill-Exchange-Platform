import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Link as LinkIcon, CheckCircle, Loader2 } from 'lucide-react';
import axios from '../api/axios';

const SessionWorkspaceModal = ({ req, currentUserId, onClose, onUpdate, onComplete }) => {
  const [links, setLinks] = useState(req.sharedLinks || []);
  const [agenda, setAgenda] = useState(req.agendaItems || []);
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newAgenda, setNewAgenda] = useState('');
  const [saving, setSaving] = useState(false);

  // For the Review Modal
  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const isReceiver = req.receiverId._id === currentUserId;
  const otherUser = isReceiver ? req.senderId : req.receiverId;
  const targetSkillId = isReceiver ? req.offeredSkillId?._id : req.requestedSkillId?._id;

  const saveWorkspace = async (updatedLinks, updatedAgenda) => {
    setSaving(true);
    try {
      const { data } = await axios.put(`/exchange/${req._id}/workspace`, {
        sharedLinks: updatedLinks,
        agendaItems: updatedAgenda
      });
      setLinks(data.sharedLinks);
      setAgenda(data.agendaItems);
      onUpdate(data);
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddLink = (e) => {
    e.preventDefault();
    if (!newLinkUrl) return;
    const updated = [...links, { url: newLinkUrl, title: newLinkTitle || newLinkUrl }];
    setNewLinkUrl('');
    setNewLinkTitle('');
    saveWorkspace(updated, agenda);
  };

  const handleRemoveLink = (index) => {
    const updated = links.filter((_, i) => i !== index);
    saveWorkspace(updated, agenda);
  };

  const handleAddAgenda = (e) => {
    e.preventDefault();
    if (!newAgenda) return;
    const updated = [...agenda, { text: newAgenda, isCompleted: false }];
    setNewAgenda('');
    saveWorkspace(links, updated);
  };

  const handleToggleAgenda = (index) => {
    const updated = [...agenda];
    updated[index].isCompleted = !updated[index].isCompleted;
    saveWorkspace(links, updated);
  };

  const handleRemoveAgenda = (index) => {
    const updated = agenda.filter((_, i) => i !== index);
    saveWorkspace(links, updated);
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    try {
      if (targetSkillId) {
        await axios.post('/users/reviews', {
          targetUserId: otherUser._id,
          skillId: targetSkillId,
          rating,
          comment
        });
      }
      // Mark as completed
      await axios.put(`/exchange/${req._id}/status`, { status: 'completed' });
      onComplete();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Failed to submit review.');
      setSubmittingReview(false);
    }
  };

  if (showReview) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col p-6 animate-in zoom-in-95 duration-200">
          <h2 className="text-xl font-medium text-brand-text mb-4">Review Session with {otherUser.name}</h2>
          <form onSubmit={handleSubmitReview}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-brand-text mb-2">Rating</label>
              <div className="flex gap-2">
                {[1,2,3,4,5].map(num => (
                  <button
                    type="button"
                    key={num}
                    onClick={() => setRating(num)}
                    className={`w-10 h-10 rounded-full text-lg font-medium transition-colors ${rating >= num ? 'bg-yellow-400 text-white' : 'bg-brand-surface-2 text-brand-muted'}`}
                  >
                    ★
                  </button>
                ))}
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-brand-text mb-2">Feedback (Optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="w-full text-sm rounded-[8px] border-black/[0.12] bg-brand-surface-2 focus:border-brand-text focus:ring-1 focus:ring-brand-text py-2 px-3 resize-none"
                rows={3}
                placeholder="How was the session?"
              ></textarea>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="px-4 py-2 text-sm font-medium text-brand-text hover:bg-black/[0.02] rounded-full transition-colors"
                disabled={submittingReview}
              >
                Back
              </button>
              <button
                type="submit"
                disabled={submittingReview}
                className="px-5 py-2 text-sm font-medium text-brand-bg bg-brand-text hover:brightness-110 rounded-full transition-colors flex items-center"
              >
                {submittingReview ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Submit & Complete
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex justify-between items-center px-6 py-4 border-b border-black/[0.08]">
          <div>
            <h2 className="text-lg font-medium text-brand-text">Session Workspace</h2>
            <p className="text-xs text-brand-muted">with {otherUser.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/[0.05] transition-colors text-brand-muted">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Shared Links */}
          <section>
            <h3 className="text-sm font-medium uppercase tracking-wider text-brand-muted mb-4 border-b border-black/[0.06] pb-1">Shared Links & Resources</h3>
            <ul className="space-y-3 mb-4">
              {links.length === 0 && <p className="text-xs text-brand-faint italic">No links shared yet.</p>}
              {links.map((link, i) => (
                <li key={i} className="flex items-center justify-between group">
                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center text-sm text-blue-600 hover:underline max-w-[85%] truncate">
                    <LinkIcon className="w-3.5 h-3.5 mr-2 shrink-0" />
                    <span className="truncate">{link.title || link.url}</span>
                  </a>
                  <button onClick={() => handleRemoveLink(i)} className="opacity-0 group-hover:opacity-100 text-status-error hover:bg-status-error/10 p-1 rounded transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={handleAddLink} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Title (optional)" 
                value={newLinkTitle} 
                onChange={(e) => setNewLinkTitle(e.target.value)}
                className="w-1/3 text-xs rounded bg-brand-surface-2 border-black/[0.12] focus:ring-brand-text"
              />
              <input 
                type="url" 
                placeholder="https://..." 
                value={newLinkUrl} 
                onChange={(e) => setNewLinkUrl(e.target.value)}
                required
                className="flex-1 text-xs rounded bg-brand-surface-2 border-black/[0.12] focus:ring-brand-text"
              />
              <button type="submit" disabled={saving} className="bg-brand-surface-2 hover:bg-black/[0.05] p-2 rounded border border-black/[0.12]">
                <Plus className="w-4 h-4 text-brand-text" />
              </button>
            </form>
          </section>

          {/* Agenda / Checklist */}
          <section>
            <h3 className="text-sm font-medium uppercase tracking-wider text-brand-muted mb-4 border-b border-black/[0.06] pb-1">Agenda & Checklist</h3>
            <ul className="space-y-2 mb-4">
              {agenda.length === 0 && <p className="text-xs text-brand-faint italic">No agenda items added.</p>}
              {agenda.map((item, i) => (
                <li key={i} className="flex items-start justify-between group py-1">
                  <label className="flex items-start gap-2 cursor-pointer flex-1">
                    <input 
                      type="checkbox" 
                      checked={item.isCompleted} 
                      onChange={() => handleToggleAgenda(i)}
                      className="mt-0.5 rounded text-brand-text border-black/[0.2] focus:ring-brand-text"
                    />
                    <span className={`text-sm ${item.isCompleted ? 'line-through text-brand-faint' : 'text-brand-text'}`}>{item.text}</span>
                  </label>
                  <button onClick={() => handleRemoveAgenda(i)} className="opacity-0 group-hover:opacity-100 text-status-error hover:bg-status-error/10 p-1 rounded transition-all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
            <form onSubmit={handleAddAgenda} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Add a topic or task..." 
                value={newAgenda} 
                onChange={(e) => setNewAgenda(e.target.value)}
                required
                className="flex-1 text-xs rounded bg-brand-surface-2 border-black/[0.12] focus:ring-brand-text"
              />
              <button type="submit" disabled={saving} className="bg-brand-surface-2 hover:bg-black/[0.05] p-2 rounded border border-black/[0.12]">
                <Plus className="w-4 h-4 text-brand-text" />
              </button>
            </form>
          </section>
        </div>

        <div className="p-6 border-t border-black/[0.08] bg-brand-surface-1">
          <button 
            onClick={() => setShowReview(true)}
            className="w-full py-2.5 text-sm font-medium rounded-full bg-brand-text text-brand-bg hover:brightness-110 flex items-center justify-center transition-all"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Mark Session Complete
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionWorkspaceModal;
