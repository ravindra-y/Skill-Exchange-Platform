import React, { useState, useEffect, useContext } from 'react';
import axios from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Check, X, Video, Loader2, Trash2 } from 'lucide-react';

const Requests = () => {
  const { user } = useContext(AuthContext);
  const [requests, setRequests] = useState({ sent: [], received: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data } = await axios.get('/exchange');
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch requests');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (id, status) => {
    try {
      await axios.put(`/exchange/${id}/status`, { status });
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update status');
    }
  };

  const handleDeleteRequest = async (id) => {
    if (!window.confirm('Are you sure you want to delete this request from your history?')) return;
    try {
      await axios.delete(`/exchange/${id}`);
      fetchRequests();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to delete request');
    }
  };

  const RequestCard = ({ req, isReceived }) => {
    const otherUser  = isReceived ? req.senderId : req.receiverId;
    const isPending  = req.status === 'pending';
    const isAccepted = req.status === 'accepted';

    return (
      <div className="card card-body flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Info */}
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-brand-text">{otherUser.name}</span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
              req.status === 'pending'
                ? 'bg-brand-surface-2 text-brand-muted border border-black/[0.08]'
                : req.status === 'accepted'
                ? 'bg-brand-text text-brand-bg'
                : 'bg-brand-surface-2 text-brand-faint'
            }`}>
              {req.status}
            </span>
          </div>
          <p className="text-xs text-brand-muted">
            {isReceived
              ? 'Wants to exchange skills with you'
              : 'You requested to exchange skills'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 w-full sm:w-auto shrink-0">
          {isReceived && isPending && (
            <>
              <button
                onClick={() => handleUpdateStatus(req._id, 'accepted')}
                className="btn-primary flex-1 sm:flex-none py-1.5"
              >
                <Check className="w-4 h-4" /> Accept
              </button>
              <button
                onClick={() => handleUpdateStatus(req._id, 'rejected')}
                className="flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-full border border-status-error/30 text-status-error hover:bg-status-error/5 flex items-center justify-center gap-1 transition-colors"
              >
                <X className="w-4 h-4" /> Reject
              </button>
            </>
          )}
          {!isReceived && isPending && (
            <button
              onClick={() => handleUpdateStatus(req._id, 'cancelled')}
              className="btn-secondary flex-1 sm:flex-none py-1.5"
            >
              Cancel
            </button>
          )}
          {isAccepted && (
            <Link
              to={`/room/${req._id}`}
              className="btn-primary flex-1 sm:flex-none justify-center py-1.5"
            >
              <Video className="w-4 h-4" /> Enter Room
            </Link>
          )}
          {(req.status === 'rejected' || req.status === 'cancelled') && (
            <button
              onClick={() => handleDeleteRequest(req._id)}
              className="flex-1 sm:flex-none px-4 py-1.5 text-sm font-medium rounded-full border border-black/[0.08] text-brand-muted hover:text-status-error hover:bg-[#fef2f2] hover:border-[#fca5a5] flex items-center justify-center gap-1 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-page">
      <Loader2 className="w-6 h-6 animate-spin text-brand-text" />
      <span className="ml-3 text-sm text-brand-muted">Loading requests…</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 sm:px-8">
      <h1 className="text-3xl font-medium tracking-tight text-brand-text mb-8">
        Exchange Requests
      </h1>

      <section className="mb-10">
        <h2 className="text-xs font-medium uppercase tracking-label text-brand-muted mb-4 pb-2 border-b border-black/[0.06]">
          Received
        </h2>
        {requests.received.length === 0 ? (
          <p className="text-sm text-brand-faint italic">No received requests.</p>
        ) : (
          <div className="space-y-3">
            {requests.received.map(req => (
              <RequestCard key={req._id} req={req} isReceived={true} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs font-medium uppercase tracking-label text-brand-muted mb-4 pb-2 border-b border-black/[0.06]">
          Sent
        </h2>
        {requests.sent.length === 0 ? (
          <p className="text-sm text-brand-faint italic">No sent requests.</p>
        ) : (
          <div className="space-y-3">
            {requests.sent.map(req => (
              <RequestCard key={req._id} req={req} isReceived={false} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default Requests;
