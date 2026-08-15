import React, { useContext } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';

const Home = () => {
  const { user } = useContext(AuthContext);

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] px-4">
      <h1 className="text-5xl font-extrabold text-gray-900 mb-6 text-center tracking-tight">
        Exchange Skills, <span className="text-indigo-600">Empower Growth</span>
      </h1>
      <p className="text-xl text-gray-600 mb-10 max-w-2xl text-center">
        Connect with people who want to learn what you know, and can teach you what you want to learn. A true peer-to-peer skill exchange platform.
      </p>
      <div className="space-x-4">
        <Link to="/signup" className="px-8 py-3 bg-indigo-600 text-white rounded-lg font-medium shadow-md hover:bg-indigo-700 transition">
          Get Started
        </Link>
        <Link to="/login" className="px-8 py-3 bg-white text-indigo-600 border border-indigo-200 rounded-lg font-medium shadow-sm hover:bg-gray-50 transition">
          Log in
        </Link>
      </div>
    </div>
  );
};

export default Home;
