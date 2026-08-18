import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

const Signup = () => {
  const [formData, setFormData] = useState({ name: '', username: '', email: '', password: '' });
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { signup } = useContext(AuthContext);
  const navigate   = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signup(formData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Sign up failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-70px)] px-6 py-12 bg-brand-bg">
      <div className="w-full max-w-sm">
        {/* Heading */}
        <h1 className="text-3xl font-medium tracking-tight text-brand-text mb-1">Create account</h1>
        <p className="text-sm text-brand-muted mb-8">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-text underline underline-offset-2 hover:opacity-70 transition-opacity">
            Sign in
          </Link>
        </p>

        {/* Error */}
        {error && (
          <div className="mb-5 px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="input-label">Full Name</label>
            <input
              type="text"
              name="name"
              required
              className="input-field"
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="input-label">Username</label>
            <input
              type="text"
              name="username"
              required
              className="input-field"
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="input-label">Email address</label>
            <input
              type="email"
              name="email"
              required
              className="input-field"
              onChange={handleChange}
            />
          </div>
          <div>
            <label className="input-label">Password</label>
            <input
              type="password"
              name="password"
              required
              className="input-field"
              onChange={handleChange}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 mt-1"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Signup;
