import React, { useEffect, useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { MessageSquare, Loader2 } from 'lucide-react';

export default function Conversations() {
  const { user } = useContext(AuthContext);
  const { unreadCounts } = useChat();
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await api.get('/exchange');
        const accepted = [
          ...data.sent.filter(r => r.status === 'accepted'),
          ...data.received.filter(r => r.status === 'accepted'),
        ];
        const seen = new Set();
        const unique = accepted.filter(r => {
          if (seen.has(r._id)) return false;
          seen.add(r._id);
          return true;
        });
        setExchanges(unique);
      } catch (err) {
        setError('Failed to load conversations.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return (
    <div className="loading-page">
      <Loader2 className="w-6 h-6 animate-spin text-brand-text" />
      <span className="ml-3 text-sm text-brand-muted">Loading…</span>
    </div>
  );

  if (error) return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">{error}</div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 sm:px-8">
      <h1 className="text-3xl font-medium tracking-tight text-brand-text mb-8 flex items-center gap-3">
        Messages
      </h1>

      {exchanges.length === 0 ? (
        <div className="empty-card">
          <MessageSquare className="w-8 h-8 text-brand-line mx-auto mb-3" />
          <p className="text-sm text-brand-muted">No active conversations yet.</p>
          <p className="text-xs text-brand-faint mt-1">Accept a skill exchange request to start chatting.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {exchanges.map(req => {
            const partner = req.senderId?._id === user?._id || req.senderId === user?._id
              ? req.receiverId
              : req.senderId;
            const unread = unreadCounts[req._id] || 0;

            return (
              <li key={req._id}>
                <Link
                  to={`/conversations/${req._id}`}
                  className="flex items-center justify-between p-4 card hover:border-black/[0.16] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-brand-surface-2 border border-black/[0.08] flex items-center justify-center shrink-0">
                      <span className="text-sm font-medium text-brand-muted">
                        {(partner?.name || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-brand-text group-hover:text-brand-text transition-colors">
                        {partner?.name || 'Unknown'}
                      </p>
                      <p className="text-xs text-brand-faint">@{partner?.username || '—'}</p>
                    </div>
                  </div>

                  {unread > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-brand-text text-brand-bg shrink-0">
                      {unread > 9 ? '9+' : unread}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
