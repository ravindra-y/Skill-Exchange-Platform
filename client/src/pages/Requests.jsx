import React, { useState, useEffect, useContext } from 'react';
import axios from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Check, X, Video, Inbox, Loader2 } from 'lucide-react';

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
      fetchRequests(); // refresh
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to update status');
    }
  };

  const RequestCard = ({ req, isReceived }) => {
    const otherUser = isReceived ? req.senderId : req.receiverId;
    const isPending = req.status === 'pending';
    const isAccepted = req.status === 'accepted';

    return (
      <div className="card mb-4">
        <div className="card-body flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 sm:p-5">
          <div className="mb-4 sm:mb-0">
            <div className="flex items-center space-x-3 mb-1">
              <h3 className="font-semibold text-gray-900">{otherUser.name}</h3>
              <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide ${
                req.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                req.status === 'accepted' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {req.status}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {isReceived ? 'Wants to exchange skills with you' : 'You requested to exchange skills'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            {isReceived && isPending && (
              <>
                <button 
                  onClick={() => handleUpdateStatus(req._id, 'accepted')}
                  className="btn-primary w-full sm:w-auto"
                >
                  <Check className="w-4 h-4" /> Accept
                </button>
                <button 
                  onClick={() => handleUpdateStatus(req._id, 'rejected')}
                  className="btn-danger w-full sm:w-auto bg-red-100 text-red-700 hover:bg-red-200 border-none shadow-none"
                >
                  <X className="w-4 h-4" /> Reject
                </button>
              </>
            )}
            {!isReceived && isPending && (
              <button 
                onClick={() => handleUpdateStatus(req._id, 'cancelled')}
                className="btn-secondary w-full sm:w-auto"
              >
                Cancel Request
              </button>
            )}
            {isAccepted && (
              <Link 
                to={`/room/${req._id}`}
                className="btn-primary w-full sm:w-auto"
              >
                <Video className="w-4 h-4" /> Enter Room
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="loading-page">
      <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      <span className="ml-3 text-gray-600 font-medium">Loading requests…</span>
    </div>
  );

  return (
    <div className="page-container">
      <h1 className="page-title">
        <Inbox className="w-8 h-8 text-indigo-600" />
        Exchange Requests
      </h1>
      
      <div className="mb-10">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Received Requests</h2>
        {requests.received.length === 0 ? (
          <div className="empty-state py-8">
            <span className="empty-state-text text-sm">No received requests.</span>
          </div>
        ) : (
          requests.received.map(req => <RequestCard key={req._id} req={req} isReceived={true} />)
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Sent Requests</h2>
        {requests.sent.length === 0 ? (
          <div className="empty-state py-8">
            <span className="empty-state-text text-sm">No sent requests.</span>
          </div>
        ) : (
          requests.sent.map(req => <RequestCard key={req._id} req={req} isReceived={false} />)
        )}
      </div>
    </div>
  );
};

export default Requests;
