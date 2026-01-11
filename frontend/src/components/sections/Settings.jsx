import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';

export default function Settings({ subSection }) {
  const navigate = useNavigate();
  const { theme: currentTheme, setTheme } = useTheme();
  const userEmail = localStorage.getItem('user_email') || 'User';
  const userName = localStorage.getItem('user_name') || userEmail.split('@')[0];
  const [displayName, setDisplayName] = useState(userName);
  const [profilePic, setProfilePic] = useState(localStorage.getItem('profile_pic') || '');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [fyersConnected, setFyersConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const fileInputRef = useRef(null);

  // Check connection status on mount and when subsection changes
  React.useEffect(() => {
    checkFyersStatus();
  }, []); // Run on mount
  
  React.useEffect(() => {
    checkFyersStatus();
  }, [subSection]); // Also run when subsection changes

  const checkFyersStatus = async () => {
    try {
      const response = await fetch('/fyers/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      const data = await response.json();
      setFyersConnected(data.connected);
    } catch (error) {
      console.error('Error checking Fyers status:', error);
    }
  };

  const handleFyersConnect = async () => {
    setIsConnecting(true);
    try {
      const response = await fetch('/fyers/auth-url', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error getting Fyers auth URL:', error);
      alert('Failed to connect to Fyers. Please try again later.');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleFyersDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect your Fyers account?')) return;
    
    try {
      await fetch('/fyers/disconnect', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      setFyersConnected(false);
    } catch (error) {
      console.error('Error disconnecting Fyers:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user_email');
    navigate('/login');
  };

  const handleResetWallet = () => {
    // This would call an API endpoint to reset the wallet
    setShowResetConfirm(false);
    alert('Wallet reset feature coming soon!');
  };

  const handleProfilePicChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        setProfilePic(base64);
        localStorage.setItem('profile_pic', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDisplayNameSave = () => {
    localStorage.setItem('user_name', displayName);
    alert('Display name saved!');
  };

  if (subSection === 'preferences') {
    return (
      <div className="settings-section">
        <div className="section-header">
          <div className="section-title">
            <span className="section-title-icon">🎨</span>
            <h2>Preferences</h2>
          </div>
        </div>

        <div className="settings-card">
          <h3>Display Settings</h3>
          <div className="settings-list">
            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label">Theme</span>
                <span className="settings-item-desc">Choose your preferred theme</span>
              </div>
              <select 
                className="settings-select" 
                value={currentTheme}
                onChange={(e) => {
                  setTheme(e.target.value);
                }}
              >
                <option value="dark">Dark Mode</option>
                <option value="light">Light Mode</option>
                <option value="glass">Glass Mode</option>
              </select>
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label">Currency Format</span>
                <span className="settings-item-desc">Display currency format</span>
              </div>
              <select className="settings-select" defaultValue="inr">
                <option value="inr">₹ INR (Indian Rupee)</option>
              </select>
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label">Chart Default Interval</span>
                <span className="settings-item-desc">Default time interval for charts</span>
              </div>
              <select className="settings-select" defaultValue="1d">
                <option value="1m">1 Minute</option>
                <option value="5m">5 Minutes</option>
                <option value="15m">15 Minutes</option>
                <option value="1h">1 Hour</option>
                <option value="1d">1 Day</option>
              </select>
            </div>
          </div>
        </div>

        <div className="settings-card">
          <h3>Notifications</h3>
          <div className="settings-list">
            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label">Trade Notifications</span>
                <span className="settings-item-desc">Get notified when trades are executed</span>
              </div>
              <label className="settings-toggle">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="settings-item">
              <div className="settings-item-info">
                <span className="settings-item-label">Price Alerts</span>
                <span className="settings-item-desc">Receive alerts when stocks hit target prices</span>
              </div>
              <label className="settings-toggle">
                <input type="checkbox" defaultChecked />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Profile view (default)
  return (
    <div className="settings-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">👤</span>
          <h2>Profile</h2>
        </div>
      </div>

      <div className="settings-card">
        <div className="profile-header">
          <div 
            className="profile-avatar clickable" 
            onClick={() => fileInputRef.current?.click()}
            title="Click to change profile picture"
            style={profilePic ? { backgroundImage: `url(${profilePic})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}
          >
            {!profilePic && displayName.charAt(0).toUpperCase()}
            <div className="avatar-overlay">📷</div>
          </div>
          <input 
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleProfilePicChange}
            style={{ display: 'none' }}
          />
          <div className="profile-info">
            <h3>{displayName}</h3>
            <span className="profile-email">{userEmail}</span>
            <span className="profile-badge">Paper Trading Account</span>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3>Personal Information</h3>
        <div className="settings-list">
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-label">Display Name</span>
              <span className="settings-item-desc">This name will be shown in the app</span>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input 
                type="text"
                className="settings-input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
              />
              <button className="settings-action-link primary" onClick={handleDisplayNameSave}>
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="settings-card">
        <h3>Broker Connections</h3>
        <p className="settings-desc">Connect your real broker accounts to view holdings and place real trades.</p>
        <div className="settings-list">
          <div className="settings-item">
            <div className="settings-item-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🦊</span>
                <div>
                  <span className="settings-item-label">Fyers</span>
                  <span className="settings-item-desc">Trade with your Fyers account</span>
                </div>
              </div>
            </div>
            {fyersConnected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span className="badge-connected">Connected</span>
                <button className="settings-action-link danger" onClick={handleFyersDisconnect}>Disconnect</button>
              </div>
            ) : (
              <button className="settings-action-link primary" onClick={handleFyersConnect} disabled={isConnecting}>
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>

          <div className="settings-item disabled">
            <div className="settings-item-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.5rem' }}>🦅</span>
                <div>
                  <span className="settings-item-label">Zerodha</span>
                  <span className="settings-item-desc">Coming Soon</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3>Account Information</h3>

        <div className="settings-list">
          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-label">Email</span>
              <span className="settings-item-value">{userEmail}</span>
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-label">Account Type</span>
              <span className="settings-item-value">Market Sandbox (Demo)</span>
            </div>
          </div>

          <div className="settings-item">
            <div className="settings-item-info">
              <span className="settings-item-label">Starting Balance</span>
              <span className="settings-item-value">₹1,00,000</span>
            </div>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <h3>Account Actions</h3>
        <div className="settings-actions">
          <button
            className="settings-action-btn warning"
            onClick={() => setShowResetConfirm(true)}
          >
            <span>🔄</span>
            Reset Wallet
          </button>
          <button className="settings-action-btn danger" onClick={handleLogout}>
            <span>🚪</span>
            Logout
          </button>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="stock-trade-modal" onClick={() => setShowResetConfirm(false)}>
          <div className="stock-trade-shell" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="stock-trade-header">
              <div>
                <h3>Reset Wallet?</h3>
              </div>
              <button className="icon-button" onClick={() => setShowResetConfirm(false)}>✕</button>
            </div>
            <p style={{ marginBottom: '1.5rem' }}>
              This will reset your wallet balance to ₹1,00,000 and clear all your holdings and order history. This action cannot be undone.
            </p>
            <div className="stock-trade-actions" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <button className="chart-btn" onClick={() => setShowResetConfirm(false)}>
                Cancel
              </button>
              <button className="sell-btn" onClick={handleResetWallet}>
                Reset Wallet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
