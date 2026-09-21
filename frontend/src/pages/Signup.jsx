import React, { useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Loader2, KeyRound, Mail, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';

const Signup = () => {
  const [authMethod, setAuthMethod] = useState('email'); // 'email' or 'key'
  const [formData, setFormData] = useState({ name: '', username: '', email: '', password: '' });
  const [generatedKey, setGeneratedKey] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  
  const { signup, accountSignup } = useContext(AuthContext);
  const navigate   = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleEmailSubmit = async (e) => {
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

  const handleGenerateKey = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await accountSignup();
      let val = data.accountNumber;
      let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
      setGeneratedKey(formatted);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate account key.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-70px)] px-6 py-12 bg-brand-bg">
      <div className="w-full max-w-sm">
        {/* Heading */}
        <div className="flex flex-col items-center mb-6">
           {generatedKey && authMethod === 'key' ? (
             <>
               <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
               </div>
               <h1 className="text-2xl font-medium tracking-tight text-brand-text mb-1">You're all set</h1>
               <p className="text-sm text-brand-muted">Here's your account key</p>
             </>
           ) : (
             <>
               <h1 className="text-3xl font-medium tracking-tight text-brand-text mb-1">Create account</h1>
               <p className="text-sm text-brand-muted mb-2">
                 Already have an account?{' '}
                 <Link to="/login" className="text-brand-text underline underline-offset-2 hover:opacity-70 transition-opacity">
                   Sign in
                 </Link>
               </p>
             </>
           )}
        </div>

        {/* Toggle Auth Method (Only show if not generated key yet) */}
        {!generatedKey && (
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
        )}

        {/* Error */}
        {error && (
          <div className="mb-5 px-4 py-3 text-sm text-status-error bg-[#fef2f2] border border-[#fca5a5] rounded-[8px]">
            {error}
          </div>
        )}

        {/* Content */}
        {authMethod === 'email' ? (
          <form onSubmit={handleEmailSubmit} className="space-y-5">
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
        ) : (
          <div className="space-y-6">
            {!generatedKey ? (
              <div className="flex flex-col items-center">
                 <div className="w-16 h-16 rounded-full border border-gray-700 flex items-center justify-center mb-6">
                   <KeyRound className="w-8 h-8 text-gray-400" />
                 </div>
                 <p className="text-center text-sm text-gray-400 mb-8 max-w-[240px]">
                   We'll make you a random <strong className="text-white">16-digit number</strong>. That's your only login, so keep it somewhere safe.
                 </p>
                 <button
                   onClick={handleGenerateKey}
                   disabled={loading}
                   className="btn-primary w-full py-3 mt-4 flex justify-center items-center font-medium bg-white text-black hover:bg-gray-200"
                 >
                   {loading && <Loader2 className="w-5 h-5 animate-spin mr-2" />}
                   {loading ? 'Generating...' : 'Generate my key'}
                 </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="w-full bg-[#161616] border border-[#2a2a2a] rounded-xl p-4 flex items-center justify-between mb-4">
                  <span className="text-xl font-mono tracking-wider text-white">
                    {generatedKey}
                  </span>
                  <button 
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#3a3a3a] text-sm text-white rounded-md transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                
                <div className="flex items-start gap-3 mb-8 text-yellow-500/90 text-sm max-w-[280px]">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                  <p>Keep it somewhere safe. There's no way to get it back if you lose it.</p>
                </div>

                <button
                   onClick={() => navigate('/dashboard')}
                   className="btn-primary w-full py-3 bg-white text-black hover:bg-gray-200 font-medium"
                 >
                   I've saved it
                 </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Signup;
