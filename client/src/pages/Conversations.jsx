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
        // Reuse the existing exchange endpoint — filter to accepted ones
        const { data } = await api.get('/exchange');
        const accepted = [
          ...data.sent.filter(r => r.status === 'accepted'),
          ...data.received.filter(r => r.status === 'accepted'),
        ];
        // Deduplicate by _id (shouldn't be dupes, but defensive)
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

  if (loading) {
    return (
      <div className="loading-page">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="ml-3 text-gray-600 font-medium">Loading conversations…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">{error}</div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-3xl">
      <h1 className="page-title">
        <MessageSquare className="w-8 h-8 text-indigo-600" />
        Messages
      </h1>

      {exchanges.length === 0 ? (
        <div className="empty-state">
          <MessageSquare className="empty-state-icon" />
          <span className="empty-state-text">No active conversations yet.</span>
          <span className="empty-state-subtext">Accept a skill exchange request to start chatting.</span>
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
                  className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:border-indigo-200 hover:shadow-md transition group"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar placeholder */}
                    <div className="w-11 h-11 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <span className="text-indigo-700 font-semibold text-lg">
                        {(partner?.name || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 group-hover:text-indigo-700 transition">
                        {partner?.name || 'Unknown'}
                      </p>
                      <p className="text-sm text-gray-500">@{partner?.username || '—'}</p>
                    </div>
                  </div>

                  {unread > 0 && (
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">
                      {unread > 99 ? '99+' : unread}
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
