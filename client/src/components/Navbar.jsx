import React, { useContext, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { Menu, X } from 'lucide-react';

const Navbar = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const chatCtx = useChat();
  const totalUnread = chatCtx?.totalUnread ?? 0;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const navLinks = user ? [
    { name: 'Discover',   to: '/discover' },
    { name: 'Requests',   to: '/requests' },
    { name: 'Messages',   to: '/conversations', badge: totalUnread },
    { name: 'Blog',       to: '/blog' },
    { name: 'Playlister', to: '/playlister' },
    { name: 'Profile',    to: '/dashboard' },
  ] : [];

  const isActive = (path) => location.pathname === path;

  const linkBase = 'relative text-sm font-medium text-brand-muted hover:text-brand-text transition-colors duration-150';
  const linkActive = 'text-brand-text after:absolute after:-bottom-0.5 after:left-0 after:w-full after:h-px after:bg-brand-text';

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled
          ? 'bg-brand-bg border-b border-black/[0.08]'
          : 'bg-transparent border-b border-transparent'
      }`}
    >
      <div className="max-w-[1200px] mx-auto px-6 flex items-center justify-between h-[70px]">

        {/* Wordmark */}
        <Link
          to="/"
          className="text-brand-text font-semibold text-lg tracking-tight hover:opacity-80 transition-opacity"
        >
          SkillEx
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.name}
              to={link.to}
              className={`${linkBase} ${isActive(link.to) ? linkActive : ''}`}
            >
              {link.name}
              {link.badge > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold leading-none rounded-full bg-brand-text text-brand-bg">
                  {link.badge > 9 ? '9+' : link.badge}
                </span>
              )}
            </Link>
          ))}
        </div>

        {/* Desktop actions */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-brand-muted hover:text-brand-text transition-colors"
            >
              Logout
            </button>
          ) : (
            <>
              <Link to="/login" className="btn-secondary text-sm">Login</Link>
              <Link to="/signup" className="btn-primary text-sm">Get Started</Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden p-2 text-brand-muted hover:text-brand-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-text rounded-[8px]"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div className="md:hidden bg-brand-bg border-t border-black/[0.08]">
          <div className="max-w-[1200px] mx-auto px-6 py-6 flex flex-col gap-5">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.to}
                className={`text-base font-medium flex items-center justify-between ${
                  isActive(link.to) ? 'text-brand-text' : 'text-brand-muted'
                }`}
              >
                {link.name}
                {link.badge > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-brand-text text-brand-bg">
                    {link.badge > 9 ? '9+' : link.badge}
                  </span>
                )}
              </Link>
            ))}
            {user ? (
              <button
                onClick={handleLogout}
                className="text-left text-base font-medium text-brand-muted hover:text-status-error transition-colors"
              >
                Logout
              </button>
            ) : (
              <div className="flex flex-col gap-3 pt-2 border-t border-black/[0.08]">
                <Link to="/login" className="btn-secondary w-full justify-center">Login</Link>
                <Link to="/signup" className="btn-primary w-full justify-center">Get Started</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
