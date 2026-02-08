import React, { useState, useEffect } from 'react';
import { authApi } from '../lib/api.js';
import VirtualTrading from './VirtualTrading.jsx';

const API_BASE_URL = window.location.origin;

/**
 * RealTrading component - wrapper around VirtualTrading that focuses on real broker integration
 * Shows Fyers connection status and provides easy access to connect if not connected
 */
const RealTrading = ({ initialTab = 'trade' }) => {
  const [fyersStatus, setFyersStatus] = useState({
    connected: false,
    loading: true,
    error: null
  });
  const [connecting, setConnecting] = useState(false);

  // Check Fyers connection status on mount
  useEffect(() => {
    checkFyersStatus();
  }, []);

  const checkFyersStatus = async () => {
    try {
      const res = await authApi(`${API_BASE_URL}/fyers/status`);
      setFyersStatus({
        connected: res.connected,
        loading: false,
        error: null,
        connectedAt: res.connected_at,
        expiresAt: res.expires_at
      });
    } catch (err) {
      console.error('Failed to check Fyers status:', err);
      setFyersStatus({
        connected: false,
        loading: false,
        error: err.message || 'Failed to check Fyers status'
      });
    }
  };

  const handleConnectFyers = async () => {
    setConnecting(true);
    try {
      const res = await authApi(`${API_BASE_URL}/fyers/auth-url`);
      if (res.url) {
        // Redirect to Fyers auth URL
        window.location.href = res.url;
      } else {
        alert('Failed to get Fyers auth URL');
      }
    } catch (err) {
      console.error('Failed to get Fyers auth URL:', err);
      alert('Error: ' + (err.message || 'Failed to connect to Fyers'));
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnectFyers = async () => {
    if (!confirm('Are you sure you want to disconnect Fyers?')) return;
    
    try {
      await authApi(`${API_BASE_URL}/fyers/disconnect`, {
        method: 'DELETE'
      });
      setFyersStatus({
        connected: false,
        loading: false,
        error: null
      });
    } catch (err) {
      console.error('Failed to disconnect Fyers:', err);
      alert('Error: ' + (err.message || 'Failed to disconnect Fyers'));
    }
  };

  // Show loading state
  if (fyersStatus.loading) {
    return (
      <div className="real-trading-container">
        <div className="real-trading-loading">
          <div className="spinner"></div>
          <p>Checking broker connection...</p>
        </div>
      </div>
    );
  }

  // Show connect prompt if not connected
  if (!fyersStatus.connected) {
    return (
      <div className="real-trading-container">
        <div className="real-trading-connect-prompt">
          <div className="connect-icon">🔗</div>
          <h2>Connect Your Broker</h2>
          <p className="connect-description">
            Connect your Fyers account to start real trading. Your credentials are securely handled through Fyers' official OAuth flow.
          </p>
          
          <div className="broker-options">
            <div className="broker-card fyers">
              <div className="broker-header">
                <span className="broker-logo">📈</span>
                <span className="broker-name">Fyers</span>
              </div>
              <p className="broker-desc">India's trusted stockbroker with low brokerage and advanced trading platform</p>
              <button 
                className="connect-btn primary"
                onClick={handleConnectFyers}
                disabled={connecting}
              >
                {connecting ? 'Connecting...' : 'Connect Fyers'}
              </button>
            </div>
            
            {/* Placeholder for future brokers */}
            <div className="broker-card coming-soon">
              <div className="broker-header">
                <span className="broker-logo">🏦</span>
                <span className="broker-name">More Brokers</span>
              </div>
              <p className="broker-desc">Support for Zerodha, Angel One, and more coming soon</p>
              <button className="connect-btn disabled" disabled>
                Coming Soon
              </button>
            </div>
          </div>

          {fyersStatus.error && (
            <div className="error-message">
              <span className="error-icon">⚠️</span>
              {fyersStatus.error}
            </div>
          )}
        </div>
      </div>
    );
  }

  // If connected, show the trading interface with Fyers connection status
  return (
    <div className="real-trading-container">
      {/* Fyers Connected Banner */}
      <div className="broker-status-banner connected">
        <div className="broker-status-info">
          <span className="status-icon">✓</span>
          <span className="status-text">
            <strong>Fyers Connected</strong>
            <span className="status-detail">Live trading enabled</span>
          </span>
        </div>
        <button 
          className="disconnect-btn"
          onClick={handleDisconnectFyers}
        >
          Disconnect
        </button>
      </div>

      {/* Pass to VirtualTrading with live mode enforced */}
      <VirtualTrading initialTab={initialTab} mode="real" />
    </div>
  );
};

export default RealTrading;
