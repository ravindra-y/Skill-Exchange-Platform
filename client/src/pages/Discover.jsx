import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from '../api/axios';
import { UserPlus, Loader2, MessageSquare } from 'lucide-react';
import ProposeSwapModal from '../components/ProposeSwapModal';

const Discover = () => {
  const [matches, setMatches]             = useState([]);
  const [loading, setLoading]             = useState(true);
  const [fetchError, setFetchError]       = useState('');
  const [requestStatus, setRequestStatus] = useState({});
  const [showPerfectMatchesOnly, setShowPerfectMatchesOnly] = useState(false);
  
  const [modalUser, setModalUser] = useState(null);
  const [modalTeachSkills, setModalTeachSkills] = useState([]);

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

  const openProposeModal = (user, teachSkills) => {
    setModalUser(user);
    setModalTeachSkills(teachSkills || []);
  };

  const handleModalSubmit = (newRequest) => {
    const receiverId = newRequest.receiverId;
    setRequestStatus(prev => ({ ...prev, [receiverId]: 'sent' }));
    
    // Update local state to reflect the new request
    setMatches(prevMatches => prevMatches.map(m => {
      if (m.user._id === receiverId) {
        return {
          ...m,
          existingRequest: {
            id: newRequest._id,
            status: 'pending',
            direction: 'sent'
          }
        };
      }
      return m;
    }));
    
    setModalUser(null);
  };

  if (loading) return (
    <div className="loading-page">
      <Loader2 className="w-6 h-6 animate-spin text-brand-text" />
      <span className="ml-3 text-sm text-brand-muted">Finding matches…</span>
    </div>
  );

  const displayedMatches = showPerfectMatchesOnly
    ? matches.filter(m => m.isPerfectMatch)
    : matches;

  return (
    <div className="w-full max-w-5xl mx-auto px-6 py-10 sm:px-8">
      {modalUser && (
        <ProposeSwapModal
          targetUser={modalUser}
          teachSkills={modalTeachSkills}
          onClose={() => setModalUser(null)}
          onSubmit={handleModalSubmit}
        />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-3xl font-medium tracking-tight text-brand-text mb-1">Discover</h1>
          <p className="text-sm text-brand-muted">
            Find people who can teach what you want to learn — and need what you can teach.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex items-center">
          <label className="flex items-center space-x-2 cursor-pointer text-sm text-brand-text">
            <input
              type="checkbox"
              checked={showPerfectMatchesOnly}
              onChange={(e) => setShowPerfectMatchesOnly(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-brand-text focus:ring-brand-text"
            />
            <span>Show Perfect Swap Matches Only</span>
          </label>
        </div>
      </div>

      {fetchError && (
        <div className="mb-6 px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
          {fetchError}
        </div>
      )}

      {!fetchError && displayedMatches.length === 0 ? (
        <div className="empty-card">
          <p className="text-sm text-brand-muted">No matches found yet.</p>
          <p className="text-xs text-brand-faint mt-1">Add more skills to your profile or adjust your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedMatches.map(({ user, score, existingRequest, isPerfectMatch, perfectMatchData, teachSkills }) => (
            <div key={user._id} className={`card card-body flex flex-col ${isPerfectMatch ? 'border-brand-text ring-1 ring-brand-text/20' : ''}`}>
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
              <p className="text-xs text-brand-muted flex-grow mb-3 leading-relaxed line-clamp-3">
                {user.bio || 'No bio provided.'}
              </p>

              {/* Perfect Match Badge */}
              {isPerfectMatch && perfectMatchData && (
                <div className="mb-4 px-3 py-2 bg-yellow-50 text-yellow-800 text-xs font-medium rounded-md border border-yellow-200">
                  ⚡ Perfect Match (You teach {perfectMatchData.youTeach}, they teach {perfectMatchData.theyTeach})
                </div>
              )}

              {/* CTA */}
              {(() => {
                if (existingRequest?.status === 'accepted') {
                  return (
                    <Link
                      to={`/conversations/${existingRequest.id}`}
                      className="w-full py-2 text-sm font-medium rounded-full flex items-center justify-center transition-all duration-150 bg-brand-surface-2 text-brand-text border border-black/[0.08] hover:bg-black/[0.02]"
                    >
                      <MessageSquare className="w-4 h-4 mr-1.5" />
                      Connected
                    </Link>
                  );
                }

                if (existingRequest?.status === 'pending' || requestStatus[user._id] === 'sent') {
                  return (
                    <button
                      disabled
                      className="w-full py-2 text-sm font-medium rounded-full flex items-center justify-center bg-brand-surface-2 text-brand-muted cursor-not-allowed"
                    >
                      Request Pending
                    </button>
                  );
                }

                return (
                  <button
                    onClick={() => openProposeModal(user, teachSkills)}
                    disabled={!!requestStatus[user._id]}
                    className={`w-full py-2 text-sm font-medium rounded-full flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-brand-text ${
                      requestStatus[user._id] === 'error'
                        ? 'bg-[#fef2f2] text-status-error border border-[#fca5a5] cursor-not-allowed'
                        : requestStatus[user._id] === 'sending'
                        ? 'bg-brand-surface-2 text-brand-muted cursor-not-allowed'
                        : isPerfectMatch
                        ? 'bg-brand-text text-brand-bg hover:brightness-[1.08] shadow-sm'
                        : 'bg-brand-surface-2 text-brand-text border border-black/[0.08] hover:bg-black/[0.02]'
                    }`}
                  >
                    {requestStatus[user._id] === 'error'   && 'Failed — retry?'}
                    {requestStatus[user._id] === 'sending' && <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Sending…</>}
                    {!requestStatus[user._id]              && (
                      <>
                        <UserPlus className="w-4 h-4 mr-1.5" />
                        {isPerfectMatch ? 'Send Exchange Request' : 'Exchange skills'}
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Discover;
