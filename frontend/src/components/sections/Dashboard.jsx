import React, { useState, useEffect, useRef } from 'react';
import { authApi, fastAuthApi } from '../../lib/api.js';
import useAutoRefresh, { useRelativeTime } from '../../hooks/useAutoRefresh';
import { useToast } from '../../contexts/ToastContext.jsx';

const API_BASE_URL = window.location.origin;

export default function Dashboard({ onNavigate }) {
  const { showError } = useToast();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [marketData, setMarketData] = useState({ gainers: [], losers: [] });

  // Track last error to avoid spamming toasts
  const lastErrorRef = useRef({ message: '', time: 0 });

  // Auto-refresh: Only market data (NSE API) - no DB calls
  // Portfolio is loaded once on mount and refreshed manually by user
  const { lastUpdate: marketUpdate } = useAutoRefresh('dashboard-market', () => loadMarketData(), 5000);
  const marketTime = useRelativeTime(marketUpdate);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Show error toast but throttle to avoid spam (max 1 per 30 seconds per message)
  const showThrottledError = (message) => {
    const now = Date.now();
    if (lastErrorRef.current.message === message && now - lastErrorRef.current.time < 30000) {
      return; // Skip if same error within 30 seconds
    }
    lastErrorRef.current = { message, time: now };
    showError(message);
  };

  const loadPortfolioSummary = async () => {
    const summaryRes = await fastAuthApi(`${API_BASE_URL}/portfolio/summary`, {}, (err) => {
      showThrottledError(`Error fetching portfolio: ${err}`);
    });
    if (summaryRes) {
      setSummary(summaryRes);
    }
  };

  const loadMarketData = async () => {
    const [gainersRes, losersRes] = await Promise.all([
      fastAuthApi(`${API_BASE_URL}/nse_data/top-gainers`, {}, (err) => {
        showThrottledError(`Error fetching NSE data for Top Gainers: ${err}`);
      }),
      fastAuthApi(`${API_BASE_URL}/nse_data/top-losers`, {}, (err) => {
        showThrottledError(`Error fetching NSE data for Top Losers: ${err}`);
      }),
    ]);
    setMarketData({
      gainers: gainersRes?.top_gainers || [],
      losers: losersRes?.top_losers || [],
    });
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPortfolioSummary(), loadMarketData()]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const walletBalance = summary?.wallet_balance ?? 100000;
  const investedValue = summary?.total_invested ?? 0;
  const currentValue = summary?.current_value ?? 0;
  const totalPnL = summary?.total_pnl ?? 0;
  const pnlPercent = investedValue > 0 ? ((totalPnL / investedValue) * 100).toFixed(2) : 0;

  return (
    <div className="dashboard-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">📊</span>
          <h2>Dashboard</h2>
        </div>
        <button onClick={loadDashboardData} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">💰</div>
          </div>
          <div className="stat-card-value">{formatCurrency(walletBalance)}</div>
          <div className="stat-card-label">Available Balance</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">📈</div>
          </div>
          <div className="stat-card-value">{formatCurrency(investedValue)}</div>
          <div className="stat-card-label">Total Invested</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">💹</div>
          </div>
          <div className="stat-card-value">{formatCurrency(currentValue)}</div>
          <div className="stat-card-label">Current Value</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">📊</div>
            <span className={`stat-card-change ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
              {totalPnL >= 0 ? '+' : ''}{pnlPercent}%
            </span>
          </div>
          <div className={`stat-card-value ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
            {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
          </div>
          <div className="stat-card-label">Total P&L</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-actions">
        <h3>Quick Actions</h3>
        <div className="quick-actions-grid">
          <button className="quick-action-btn" onClick={() => onNavigate('trading.trade')}>
            <span className="quick-action-icon">💹</span>
            <span>Trade Stocks</span>
          </button>
          <button className="quick-action-btn" onClick={() => onNavigate('trading.portfolio')}>
            <span className="quick-action-icon">📁</span>
            <span>View Portfolio</span>
          </button>
          <button className="quick-action-btn" onClick={() => onNavigate('market.gainers')}>
            <span className="quick-action-icon">📈</span>
            <span>Top Gainers</span>
          </button>
          <button className="quick-action-btn" onClick={() => onNavigate('market.losers')}>
            <span className="quick-action-icon">📉</span>
            <span>Top Losers</span>
          </button>
        </div>
      </div>

      {/* Market Overview */}
      <div className="last-updated">
        <svg className="last-updated-icon" fill="currentColor" viewBox="0 0 16 16">
          <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z"/>
          <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z"/>
        </svg>
        <span className="last-updated-text">Market data updated {marketTime}</span>
      </div>
      <div className="dashboard-market-grid">
        <div className="market-card">
          <div className="market-card-header">
            <h3>Top Gainers</h3>
            <button className="link-btn" onClick={() => onNavigate('market.gainers')}>
              View All →
            </button>
          </div>
          <div className="market-list">
            {marketData.gainers.slice(0, 5).map((stock, idx) => (
              <div key={stock.symbol || idx} className="market-item">
                <div className="market-item-info">
                  <span className="market-symbol">{stock.symbol}</span>
                  <span className="market-price">₹{Number(stock.lastPrice || 0).toLocaleString()}</span>
                </div>
                <span className="market-change positive">
                  +{Number(stock.pChange || 0).toFixed(2)}%
                </span>
              </div>
            ))}
            {marketData.gainers.length === 0 && (
              <div className="loading">No data available</div>
            )}
          </div>
        </div>

        <div className="market-card">
          <div className="market-card-header">
            <h3>Top Losers</h3>
            <button className="link-btn" onClick={() => onNavigate('market.losers')}>
              View All →
            </button>
          </div>
          <div className="market-list">
            {marketData.losers.slice(0, 5).map((stock, idx) => (
              <div key={stock.symbol || idx} className="market-item">
                <div className="market-item-info">
                  <span className="market-symbol">{stock.symbol}</span>
                  <span className="market-price">₹{Number(stock.lastPrice || 0).toLocaleString()}</span>
                </div>
                <span className="market-change negative">
                  {Number(stock.pChange || 0).toFixed(2)}%
                </span>
              </div>
            ))}
            {marketData.losers.length === 0 && (
              <div className="loading">No data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
