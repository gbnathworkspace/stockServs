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
  const [fiiDiiData, setFiiDiiData] = useState(null);

  // Track last error to avoid spamming toasts
  const lastErrorRef = useRef({ message: '', time: 0 });

  // Auto-refresh: Only market data (NSE API) - no DB calls
  // Portfolio is loaded once on mount and refreshed manually by user
  // 10 second interval to prevent request overlap
  const { lastUpdate: marketUpdate } = useAutoRefresh('dashboard-market', () => loadMarketData(), 10000);
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

  const loadFiiDiiData = async () => {
    try {
      const res = await authApi(`${API_BASE_URL}/nse_data/fii-dii-activity`).catch(() => null);
      if (res) {
        setFiiDiiData(res);
      }
    } catch (error) {
      console.error('Failed to load FII/DII data:', error);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPortfolioSummary(), loadMarketData(), loadFiiDiiData()]);
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

  const formatCrores = (value) => {
    if (!value && value !== 0) return 'N/A';
    const num = Number(value);
    if (isNaN(num)) return 'N/A';
    return `${(num / 100).toFixed(0)} Cr`;
  };

  const walletBalance = summary?.wallet_balance ?? 100000;
  const investedValue = summary?.total_invested ?? 0;
  const currentValue = summary?.current_value ?? 0;
  const totalPnL = summary?.total_pnl ?? 0;
  const pnlPercent = investedValue > 0 ? ((totalPnL / investedValue) * 100).toFixed(2) : 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const isMarketOpen = () => {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    const minute = now.getMinutes();
    const time = hour * 60 + minute;
    // Market open: Mon-Fri, 9:15 AM - 3:30 PM IST
    return day >= 1 && day <= 5 && time >= 555 && time <= 930;
  };

  return (
    <div className="dashboard-section">
      {/* Welcome + Refresh Header */}
      <div className="section-header">
        <div className="section-title">
          <h2>{getGreeting()}</h2>
        </div>
        <div className="dash-header-right">
          <span className={`market-status-badge ${isMarketOpen() ? 'open' : 'closed'}`}>
            {isMarketOpen() ? 'Market Open' : 'Market Closed'}
          </span>
          <button onClick={loadDashboardData} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Compact Portfolio Summary Bar */}
      <div className="dash-summary-bar">
        <div className="dash-summary-item" onClick={() => onNavigate('wallet.balance')}>
          <span className="dash-summary-label">Balance</span>
          <span className="dash-summary-value">{formatCurrency(walletBalance)}</span>
        </div>
        <div className="dash-summary-divider" />
        <div className="dash-summary-item" onClick={() => onNavigate('trading.portfolio')}>
          <span className="dash-summary-label">Invested</span>
          <span className="dash-summary-value">{formatCurrency(investedValue)}</span>
        </div>
        <div className="dash-summary-divider" />
        <div className="dash-summary-item" onClick={() => onNavigate('trading.portfolio')}>
          <span className="dash-summary-label">Current Value</span>
          <span className="dash-summary-value">{formatCurrency(currentValue)}</span>
        </div>
        <div className="dash-summary-divider" />
        <div className="dash-summary-item" onClick={() => onNavigate('trading.portfolio')}>
          <span className="dash-summary-label">P&L</span>
          <span className={`dash-summary-value ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
            {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
            <span className="dash-summary-pct">({totalPnL >= 0 ? '+' : ''}{pnlPercent}%)</span>
          </span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-actions">
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

      {/* FII/DII Activity */}
      {fiiDiiData && (
        <div className="fii-dii-container">
          <h3>FII/DII Activity {fiiDiiData.date && <span className="fii-dii-date">({fiiDiiData.date})</span>}</h3>
          <div className="fii-dii-row">
            <div className="fii-dii-block">
              <div className="fii-dii-title">FII (Foreign)</div>
              <div className="fii-dii-stats">
                <div className="fii-dii-stat">
                  <span className="label">Buy</span>
                  <span className="value positive">{formatCrores(fiiDiiData.fii?.buyValue)}</span>
                </div>
                <div className="fii-dii-stat">
                  <span className="label">Sell</span>
                  <span className="value negative">{formatCrores(fiiDiiData.fii?.sellValue)}</span>
                </div>
                <div className={`fii-dii-stat net ${Number(fiiDiiData.fii?.netValue) >= 0 ? 'positive' : 'negative'}`}>
                  <span className="label">Net</span>
                  <span className="value">{formatCrores(fiiDiiData.fii?.netValue)}</span>
                </div>
              </div>
            </div>
            <div className="fii-dii-block">
              <div className="fii-dii-title">DII (Domestic)</div>
              <div className="fii-dii-stats">
                <div className="fii-dii-stat">
                  <span className="label">Buy</span>
                  <span className="value positive">{formatCrores(fiiDiiData.dii?.buyValue)}</span>
                </div>
                <div className="fii-dii-stat">
                  <span className="label">Sell</span>
                  <span className="value negative">{formatCrores(fiiDiiData.dii?.sellValue)}</span>
                </div>
                <div className={`fii-dii-stat net ${Number(fiiDiiData.dii?.netValue) >= 0 ? 'positive' : 'negative'}`}>
                  <span className="label">Net</span>
                  <span className="value">{formatCrores(fiiDiiData.dii?.netValue)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
