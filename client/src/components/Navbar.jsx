import React, { useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { LogOut, User, Search, Inbox, Menu, MessageSquare } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const chatCtx = useChat();
  const totalUnread = chatCtx?.totalUnread ?? 0;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <Link to="/" className="flex-shrink-0 flex items-center">
              <span className="font-bold text-xl text-indigo-600">SkillEx</span>
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {user ? (
              <>
                <Link to="/discover" className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                  <Search className="w-4 h-4 mr-1" /> Discover
                </Link>
                <Link to="/requests" className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                  <Inbox className="w-4 h-4 mr-1" /> Requests
                </Link>
                {/* Messages link with unread badge */}
                <Link
                  to="/conversations"
                  className="relative text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium flex items-center"
                >
                  <MessageSquare className="w-4 h-4 mr-1" /> Messages
                  {totalUnread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold leading-none">
                      {totalUnread > 99 ? '99+' : totalUnread}
                    </span>
                  )}
                </Link>
                <Link to="/dashboard" className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium flex items-center">
                  <User className="w-4 h-4 mr-1" /> Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-gray-700 hover:text-red-600 px-3 py-2 rounded-md text-sm font-medium flex items-center"
                >
                  <LogOut className="w-4 h-4 mr-1" /> Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-700 hover:text-indigo-600 px-3 py-2 rounded-md text-sm font-medium">Login</Link>
                <Link to="/signup" className="bg-indigo-600 text-white hover:bg-indigo-700 px-3 py-2 rounded-md text-sm font-medium">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
