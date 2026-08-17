import React, { useContext, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { LogOut, User, Search, Inbox, Menu, MessageSquare, X } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const chatCtx = useChat();
  const totalUnread = chatCtx?.totalUnread ?? 0;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
    setIsMobileMenuOpen(false);
  };

  const navLinks = user ? [
    { name: 'Discover', to: '/discover', icon: Search },
    { name: 'Requests', to: '/requests', icon: Inbox },
    { name: 'Messages', to: '/conversations', icon: MessageSquare, badge: totalUnread },
    { name: 'Profile', to: '/dashboard', icon: User },
  ] : [];

  const isActive = (path) => location.pathname === path;

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link to="/" className="flex-shrink-0 flex items-center" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center mr-2 shadow-sm">
                <span className="font-bold text-white text-lg leading-none">S</span>
              </div>
              <span className="font-bold text-xl text-gray-900 tracking-tight">SkillEx</span>
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-2">
            {user ? (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.to}
                    className={`relative px-3 py-2 rounded-lg text-sm font-medium flex items-center transition ${
                      isActive(link.to) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <link.icon className="w-4 h-4 mr-2" /> {link.name}
                    {link.badge > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold shadow-sm">
                        {link.badge > 99 ? '99+' : link.badge}
                      </span>
                    )}
                  </Link>
                ))}
                <button
                  onClick={handleLogout}
                  className="text-gray-600 hover:bg-red-50 hover:text-red-600 px-3 py-2 rounded-lg text-sm font-medium flex items-center transition ml-2 border border-transparent"
                >
                  <LogOut className="w-4 h-4 mr-2" /> Logout
                </button>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <Link to="/login" className="btn-secondary text-sm">Login</Link>
                <Link to="/signup" className="btn-primary text-sm">Sign up</Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            >
              {isMobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {user ? (
              <>
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3 py-3 rounded-md text-base font-medium ${
                      isActive(link.to) ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center">
                      <link.icon className="w-5 h-5 mr-3" /> {link.name}
                    </div>
                    {link.badge > 0 && (
                      <span className="inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold">
                        {link.badge > 99 ? '99+' : link.badge}
                      </span>
                    )}
                  </Link>
                ))}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-3 py-3 rounded-md text-base font-medium text-red-600 hover:bg-red-50"
                >
                  <LogOut className="w-5 h-5 mr-3" /> Logout
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 px-3 py-2">
                <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="btn-secondary w-full">Login</Link>
                <Link to="/signup" onClick={() => setIsMobileMenuOpen(false)} className="btn-primary w-full">Sign up</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
