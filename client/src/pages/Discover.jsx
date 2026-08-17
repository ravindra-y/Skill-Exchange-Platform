import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { UserPlus, Loader2, Search } from 'lucide-react';

const Discover = () => {
  const [matches, setMatches]           = useState([]);
  const [loading, setLoading]           = useState(true);
  const [fetchError, setFetchError]     = useState('');
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
      // Show inline error on the card for 3 seconds
      setTimeout(() => setRequestStatus(prev => ({ ...prev, [receiverId]: null })), 3000);
    }
  };

  if (loading) return (
    <div className="loading-page">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      <span className="ml-3 text-gray-600 font-medium">Finding perfect matches…</span>
    </div>
  );

  return (
    <div className="page-container">
      <h1 className="page-title">
        <Search className="w-8 h-8 text-indigo-600" />
        Discover
      </h1>
      <p className="text-gray-600 mb-8 max-w-2xl">Find people who can teach you what you want to learn, and want to learn what you can teach.</p>

      {fetchError && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">{fetchError}</div>
      )}

      {!fetchError && matches.length === 0 ? (
        <div className="empty-state">
          <Search className="empty-state-icon" />
          <span className="empty-state-text">No matches found yet.</span>
          <span className="empty-state-subtext">Try adding more skills to your profile to increase your chances of matching!</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {matches.map(({ user, score, label }) => (
            <div key={user._id} className="card flex flex-col h-full">
              <div className="card-body flex-grow flex flex-col">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{user.name}</h3>
                    <p className="text-sm text-gray-500">@{user.username}</p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide ${
                    score >= 90 ? 'bg-green-100 text-green-800' :
                    score >= 70 ? 'bg-blue-100 text-blue-800' :
                    score >= 40 ? 'bg-amber-100 text-amber-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {score}% Match
                  </div>
                </div>
                
                <p className="text-gray-700 text-sm flex-grow mb-6 line-clamp-3">
                  {user.bio || 'No bio provided.'}
                </p>
                
                <div className="mt-auto">
                  <button
                    onClick={() => handleSendRequest(user._id)}
                    disabled={!!requestStatus[user._id]}
                    className={`w-full py-2.5 rounded-lg font-medium flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-sm disabled:opacity-100 ${
                      requestStatus[user._id] === 'sent'
                        ? 'bg-green-500 text-white cursor-not-allowed border border-green-600'
                        : requestStatus[user._id] === 'error'
                        ? 'bg-red-50 text-red-600 cursor-not-allowed border border-red-200'
                        : requestStatus[user._id] === 'sending'
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed border border-gray-200'
                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                    }`}
                  >
                    {requestStatus[user._id] === 'sent'    && 'Request Sent ✓'}
                    {requestStatus[user._id] === 'error'   && 'Failed — retry?'}
                    {requestStatus[user._id] === 'sending' && <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending…</>}
                    {!requestStatus[user._id] && <><UserPlus className="w-4 h-4 mr-2" />Exchange Skills</>}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Discover;
