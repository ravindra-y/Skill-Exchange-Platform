import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { UserPlus, Loader2 } from 'lucide-react';

const Discover = () => {
  const [matches, setMatches]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [fetchError, setFetchError]       = useState('');
  const [requestStatus, setRequestStatus] = useState({});

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const { data } = await axios.get('/discover');
        setMatches(data);
      } catch (error) {
        setFetchError('Failed to load matches. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  const handleSendRequest = async (receiverId) => {
    setRequestStatus(prev => ({ ...prev, [receiverId]: 'sending' }));
    try {
      await axios.post('/exchange', { receiverId });
      setRequestStatus(prev => ({ ...prev, [receiverId]: 'sent' }));
    } catch (error) {
      setRequestStatus(prev => ({ ...prev, [receiverId]: 'error' }));
      setTimeout(() => setRequestStatus(prev => ({ ...prev, [receiverId]: null })), 3000);
    }
  };

  if (loading) return (
    <div className="loading-page">
      <Loader2 className="w-6 h-6 animate-spin text-brand-text" />
      <span className="ml-3 text-sm text-brand-muted">Finding matches…</span>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 sm:px-8">
      <h1 className="text-3xl font-medium tracking-tight text-brand-text mb-1">Discover</h1>
      <p className="text-sm text-brand-muted mb-8">
        Find people who can teach what you want to learn — and need what you can teach.
      </p>

      {fetchError && (
        <div className="mb-6 px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
          {fetchError}
        </div>
      )}

      {!fetchError && matches.length === 0 ? (
        <div className="empty-card">
          <p className="text-sm text-brand-muted">No matches found yet.</p>
          <p className="text-xs text-brand-faint mt-1">Add more skills to your profile to find matches.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {matches.map(({ user, score }) => (
            <div key={user._id} className="card card-body flex flex-col">
              {/* Header */}
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm font-medium text-brand-text">{user.name}</h3>
                  <p className="text-xs text-brand-faint">@{user.username}</p>
                </div>
                {/* Score badge — monochrome, tinted by strength */}
                <span className={`text-[11px] font-medium px-2 py-0.5 ml-3 rounded-full border ${
                  score >= 70
                    ? 'bg-brand-text text-brand-bg border-brand-text'
                    : 'bg-brand-surface-2 text-brand-muted border-black/[0.08]'
                }`}>
                  {score}% match
                </span>
              </div>

              {/* Bio */}
              <p className="text-xs text-brand-muted flex-grow mb-5 leading-relaxed line-clamp-3">
                {user.bio || 'No bio provided.'}
              </p>

              {/* CTA */}
              <button
                onClick={() => handleSendRequest(user._id)}
                disabled={!!requestStatus[user._id]}
                className={`w-full py-2 text-sm font-medium rounded-full flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand-text ${
                  requestStatus[user._id] === 'sent'
                    ? 'bg-status-success text-white cursor-not-allowed'
                    : requestStatus[user._id] === 'error'
                    ? 'bg-[#fef2f2] text-status-error border border-[#fca5a5] cursor-not-allowed'
                    : requestStatus[user._id] === 'sending'
                    ? 'bg-brand-surface-2 text-brand-muted cursor-not-allowed'
                    : 'bg-brand-text text-brand-bg hover:brightness-[1.08]'
                }`}
              >
                {requestStatus[user._id] === 'sent'    && 'Request sent ✓'}
                {requestStatus[user._id] === 'error'   && 'Failed — retry?'}
                {requestStatus[user._id] === 'sending' && <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Sending…</>}
                {!requestStatus[user._id]              && <><UserPlus className="w-4 h-4 mr-1.5" />Exchange skills</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Discover;
