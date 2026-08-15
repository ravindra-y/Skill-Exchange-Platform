import React, { useState, useEffect, useContext } from 'react';
import axios from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { Check, X, Video } from 'lucide-react';

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
      <div className="bg-white p-5 rounded-lg shadow border border-gray-100 mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center">
        <div className="mb-4 sm:mb-0">
          <div className="flex items-center space-x-3 mb-1">
            <h3 className="font-semibold text-gray-900">{otherUser.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              req.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              req.status === 'accepted' ? 'bg-green-100 text-green-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {isReceived ? 'Wants to exchange skills with you' : 'You requested to exchange skills'}
          </p>
        </div>

        <div className="flex space-x-2 w-full sm:w-auto">
          {isReceived && isPending && (
            <>
              <button 
                onClick={() => handleUpdateStatus(req._id, 'accepted')}
                className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 flex items-center justify-center"
              >
                <Check className="w-4 h-4 mr-1" /> Accept
              </button>
              <button 
                onClick={() => handleUpdateStatus(req._id, 'rejected')}
                className="flex-1 sm:flex-none px-4 py-2 bg-red-100 text-red-700 rounded-md text-sm font-medium hover:bg-red-200 flex items-center justify-center"
              >
                <X className="w-4 h-4 mr-1" /> Reject
              </button>
            </>
          )}
          {!isReceived && isPending && (
            <button 
              onClick={() => handleUpdateStatus(req._id, 'cancelled')}
              className="flex-1 sm:flex-none px-4 py-2 bg-gray-100 text-gray-700 rounded-md text-sm font-medium hover:bg-gray-200"
            >
              Cancel Request
            </button>
          )}
          {isAccepted && (
            <Link 
              to={`/room/${req._id}`}
              className="flex-1 sm:flex-none px-4 py-2 bg-indigo-50 text-indigo-700 rounded-md text-sm font-medium hover:bg-indigo-100 flex items-center justify-center border border-indigo-200"
            >
              <Video className="w-4 h-4 mr-2" /> Enter Room
            </Link>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="p-8 text-center">Loading requests...</div>;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Exchange Requests</h1>
      
      <div className="mb-10">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">Received Requests</h2>
        {requests.received.length === 0 ? (
          <p className="text-gray-500 italic">No received requests.</p>
        ) : (
          requests.received.map(req => <RequestCard key={req._id} req={req} isReceived={true} />)
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b pb-2">Sent Requests</h2>
        {requests.sent.length === 0 ? (
          <p className="text-gray-500 italic">No sent requests.</p>
        ) : (
          requests.sent.map(req => <RequestCard key={req._id} req={req} isReceived={false} />)
        )}
      </div>
    </div>
  );
};

export default Requests;
