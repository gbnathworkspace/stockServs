import React, { useState } from 'react';

export default function OptionApex() {
  const [selectedInterval, setSelectedInterval] = useState('5m');

  const intervals = ['1m', '5m', '15m', '30m'];

  return (
    <div className="product-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">⚡</span>
          <h2>Option Apex</h2>
        </div>
        <p className="section-subtitle">
          Candle-by-candle analysis of option position building throughout the trading day
        </p>
      </div>

      {/* Interval Selector */}
      <div className="card">
        <h3>Select Candle Interval</h3>
        <div className="interval-buttons">
          {intervals.map(interval => (
            <button
              key={interval}
              className={`interval-btn ${selectedInterval === interval ? 'active' : ''}`}
              onClick={() => setSelectedInterval(interval)}
            >
              {interval}
            </button>
          ))}
        </div>
      </div>

      {/* Coming Soon Placeholder */}
      <div className="coming-soon-section">
        <div className="empty-state">
          <div className="empty-state-icon">⚡</div>
          <div className="empty-state-title">Option Apex - Coming Soon</div>
          <div className="empty-state-text">
            Advanced intraday options analysis featuring:
            <ul style={{ textAlign: 'left', marginTop: '1rem' }}>
              <li>Real-time option premium candlestick charts</li>
              <li>Per-candle OI and volume tracking</li>
              <li>Institutional vs retail flow detection</li>
              <li>Directional bias and conviction scoring</li>
              <li>Entry/Exit signal generation with risk-reward</li>
              <li>Put-Call Ratio and Max Pain calculator</li>
              <li>Implied Volatility change tracker</li>
            </ul>
          </div>
          <div className="feature-badge">Premium Feature</div>
        </div>
      </div>

      {/* Feature Preview Cards */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">📊</div>
          </div>
          <div className="stat-card-label">Option Candle Charts</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">💹</div>
          </div>
          <div className="stat-card-label">Smart Money Flow</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">🎯</div>
          </div>
          <div className="stat-card-label">Trade Signals</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">📈</div>
          </div>
          <div className="stat-card-label">PCR & Max Pain</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
