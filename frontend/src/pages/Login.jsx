import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [googleClientId, setGoogleClientId] = useState('');
  const [status, setStatus] = useState({ message: '', type: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if already logged in
    if (localStorage.getItem('access_token')) {
      navigate('/');
    }

    // Load saved Google Client ID
    const savedClientId = localStorage.getItem('GOOGLE_CLIENT_ID');
    if (savedClientId) {
      setGoogleClientId(savedClientId);
    }

    // Initialize Google Sign-In after script loads
    const initGoogle = () => {
      const clientId = localStorage.getItem('GOOGLE_CLIENT_ID');
      if (clientId && window.google) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleGoogleCredential,
        });
        window.google.accounts.id.renderButton(
          document.getElementById('google-signin'),
          { theme: 'outline', size: 'large', width: 280 }
        );
      }
    };

    // Wait for Google script
    if (window.google) {
      initGoogle();
    } else {
      const checkGoogle = setInterval(() => {
        if (window.google) {
          clearInterval(checkGoogle);
          initGoogle();
        }
      }, 200);
      return () => clearInterval(checkGoogle);
    }
  }, [navigate]);

  const handleGoogleCredential = async (response) => {
    if (!response?.credential) {
      setStatus({ message: 'Google sign-in failed', type: 'error' });
      return;
    }

    setLoading(true);
    setStatus({ message: 'Signing in with Google...', type: 'info' });

    try {
      const data = await api('/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: response.credential }),
      });
      saveToken(data);
    } catch (err) {
      setStatus({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const saveToken = (data) => {
    if (data?.access_token && data?.user) {
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user_email', data.user.email || '');
      navigate('/');
    } else {
      setStatus({ message: 'Unexpected response from server', type: 'error' });
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus({ message: 'Logging in...', type: 'info' });

    try {
      const form = new URLSearchParams();
      form.append('username', email);
      form.append('password', password);

      const data = await api('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form.toString(),
      });
      saveToken(data);
    } catch (err) {
      setStatus({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const saveGoogleClientId = () => {
    if (googleClientId) {
      localStorage.setItem('GOOGLE_CLIENT_ID', googleClientId);
      setStatus({ message: 'Saved Google Client ID. Reloading...', type: 'info' });
      setTimeout(() => window.location.reload(), 500);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome Back</h1>
          <p className="muted">Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="auth-form">
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

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or continue with</span>
        </div>

        <div className="google-section">
          <div id="google-signin" className="google-placeholder">
            {!localStorage.getItem('GOOGLE_CLIENT_ID') && (
              <span className="muted">Set Google Client ID below to enable</span>
            )}
          </div>
          
          <div className="google-config">
            <input
              type="text"
              value={googleClientId}
              onChange={(e) => setGoogleClientId(e.target.value)}
              placeholder="Google Client ID (optional)"
            />
            <button type="button" className="ghost-btn" onClick={saveGoogleClientId}>
              Save
            </button>
          </div>
        </div>

        <div className="auth-footer">
          <span className="muted">Don't have an account?</span>
          <Link to="/signup">Create one</Link>
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
