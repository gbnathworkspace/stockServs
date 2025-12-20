import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function Signup() {
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    if (localStorage.getItem('access_token')) {
      navigate('/');
    }
  }, [navigate]);

  const saveToken = (data) => {
    if (data?.access_token && data?.user) {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user_email', data.user.email || '');
      navigate('/');
    } else {
      setStatus({ message: 'Unexpected response from server', type: 'error' });
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setStatus({ message: 'Passwords do not match', type: 'error' });
      return;
    }

    if (password.length < 6) {
      setStatus({ message: 'Password must be at least 6 characters', type: 'error' });
      return;
    }

    setLoading(true);
    setStatus({ message: 'Creating account...', type: 'info' });

    try {
      const data = await api('/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          display_name: displayName || email.split('@')[0],
        }),
      });
      saveToken(data);
    } catch (err) {
      setStatus({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create Account</h1>
          <p className="muted">Join Stock Servs to start trading</p>
        </div>

        <form onSubmit={handleSignup} className="auth-form">
          <div className="form-group">
            <label htmlFor="displayName">Display Name</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Doe"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <span className="muted">Already have an account?</span>
          <Link to="/login">Sign in</Link>
        </div>

        {status.message && (
          <div className={`auth-message ${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}
