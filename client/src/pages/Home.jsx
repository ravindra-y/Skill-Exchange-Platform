import React, { useContext } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Home = () => {
  const { user } = useContext(AuthContext);

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-12 bg-slate-50">
      <div className="max-w-3xl text-center">
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-gray-900 mb-6 tracking-tight">
          Exchange Skills, <span className="text-indigo-600">Empower Growth</span>
        </h1>
        <p className="text-lg sm:text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
          Connect with people who want to learn what you know, and can teach you what you want to learn. A true peer-to-peer skill exchange platform.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link to="/signup" className="btn-primary w-full sm:w-auto text-lg px-8 py-3.5">
            Get Started
          </Link>
          <Link to="/login" className="btn-secondary w-full sm:w-auto text-lg px-8 py-3.5">
            Log in
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Home;
