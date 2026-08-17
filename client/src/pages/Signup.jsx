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
    <div className="flex items-center justify-center flex-1 px-4 py-12">
      <div className="max-w-md w-full card card-body">
        <h2 className="text-3xl font-bold text-center text-gray-900 mb-6 tracking-tight">Create an account</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm border border-red-100">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
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
            className="btn-primary w-full mt-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Creating account…' : 'Sign up'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account? <Link to="/login" className="text-indigo-600 hover:text-indigo-700 font-medium transition">Log in</Link>
        </p>
      </div>
    </div>
  );
};

export default Signup;
