import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Loader2, Eye, EyeOff, KeyRound, Mail } from 'lucide-react';

const Login = () => {
  const [authMethod, setAuthMethod] = useState('email'); // 'email' or 'key'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [showKey, setShowKey]   = useState(false);
  
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login, accountLogin } = useContext(AuthContext);
  const navigate  = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (authMethod === 'email') {
        await login(email, password);
      } else {
        await accountLogin(accountNumber.replace(/\s+/g, ''));
      }
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccountKeyChange = (e) => {
    // Format to 16 digits with spaces every 4 digits
    let val = e.target.value.replace(/\D/g, '').slice(0, 16);
    let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    setAccountNumber(formatted);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-70px)] px-6 py-12 bg-brand-bg">
      <div className="w-full max-w-sm">
        {/* Heading */}
        <h1 className="text-3xl font-medium tracking-tight text-brand-text mb-1">Welcome back</h1>
        <p className="text-sm text-brand-muted mb-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-brand-text underline underline-offset-2 hover:opacity-70 transition-opacity">
            Sign up
          </Link>
        </p>

        {/* Toggle Auth Method */}
        <div className="flex bg-[#1a1a1a] rounded-lg p-1 mb-8 border border-[#2a2a2a]">
          <button
            type="button"
            onClick={() => setAuthMethod('email')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
              authMethod === 'email' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Mail className="w-4 h-4" />
            Email
          </button>
          <button
            type="button"
            onClick={() => setAuthMethod('key')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
              authMethod === 'key' ? 'bg-[#2a2a2a] text-white shadow-sm' : 'text-gray-400 hover:text-white'
            }`}
          >
            <KeyRound className="w-4 h-4" />
            Account Key
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-5 px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {authMethod === 'email' ? (
            <>
              <div>
                <label className="input-label">Email address</label>
                <input
                  type="email"
                  required
                  className="input-field"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="input-label">Password</label>
                <input
                  type="password"
                  required
                  className="input-field"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </>
          ) : (
            <div>
              <label className="input-label">16-digit account number</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  required
                  placeholder="0000 0000 0000 0000"
                  className="input-field pr-10 font-mono tracking-wider"
                  value={accountNumber}
                  onChange={handleAccountKeyChange}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 mt-1"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
