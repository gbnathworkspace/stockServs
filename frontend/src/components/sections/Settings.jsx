import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Settings({ subSection }) {
  const navigate = useNavigate();
  const userEmail = localStorage.getItem('user_email') || 'User';
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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
              <select className="settings-select" defaultValue="dark">
                <option value="dark">Dark Mode</option>
                <option value="light" disabled>Light Mode (Coming Soon)</option>
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
          <div className="profile-avatar">
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <div className="profile-info">
            <h3>{userEmail}</h3>
            <span className="profile-badge">Paper Trading Account</span>
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
              <span className="settings-item-value">Virtual Trading (Demo)</span>
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
