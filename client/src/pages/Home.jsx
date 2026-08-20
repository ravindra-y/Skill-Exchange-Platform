import React, { useContext } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Home = () => {
  const { user } = useContext(AuthContext);

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-6 py-24 bg-brand-bg">
      <div className="w-full max-w-2xl text-center">
        {/* Eyebrow */}
        <p className="text-xs uppercase tracking-label text-brand-muted mb-8 font-medium">
          Peer-to-peer skill exchange
        </p>

        {/* Headline */}
        <h1
          className="text-5xl sm:text-6xl md:text-[64px] font-medium leading-[1.05] tracking-tighter text-brand-text mb-6"
        >
          Learn what you want.<br />Teach what you know.
        </h1>

        {/* Sub-headline */}
        <p className="text-lg text-brand-muted leading-relaxed mb-10 max-w-lg mx-auto">
          Connect with people who have the skills you need — and need the skills you have. Exchange knowledge, grow together.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link to="/signup" className="btn-primary px-6 py-2.5 text-sm">
            Get Started
          </Link>
          <Link to="/login" className="btn-secondary px-6 py-2.5 text-sm">
            Sign in
          </Link>
        </div>
      </div>

      {/* Social proof strip */}
      <div className="mt-20 text-center">
        <p className="text-xs uppercase tracking-label text-brand-faint mb-6 font-medium">
          Trusted by learners at
        </p>
        <div className="flex flex-wrap items-center justify-center gap-8 opacity-40">
          {['Figma', 'Notion', 'Linear', 'Vercel', 'Stripe'].map((name) => (
            <span key={name} className="text-sm font-semibold text-brand-muted tracking-tight">
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;
