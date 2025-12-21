import React, { useState } from 'react';

export default function SwingSpectrum() {
  const [filterType, setFilterType] = useState('breakouts');

  const filters = [
    { id: 'breakouts', label: '52W Breakouts' },
    { id: 'ma-cross', label: 'MA Crossovers' },
    { id: 'momentum', label: 'High Momentum' },
    { id: 'reversals', label: 'Trend Reversals' }
  ];

  return (
    <div className="product-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">📐</span>
          <h2>Swing Spectrum</h2>
        </div>
        <p className="section-subtitle">
          Stocks breaking barriers and signaling new trends for medium-term trading
        </p>
      </div>

      {/* Filter Selector */}
      <div className="card">
        <h3>Select Swing Trade Filter</h3>
        <div className="filter-buttons">
          {filters.map(filter => (
            <button
              key={filter.id}
              className={`filter-btn ${filterType === filter.id ? 'active' : ''}`}
              onClick={() => setFilterType(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Coming Soon Placeholder */}
      <div className="coming-soon-section">
        <div className="empty-state">
          <div className="empty-state-icon">📐</div>
          <div className="empty-state-title">Swing Spectrum - Coming Soon</div>
          <div className="empty-state-text">
            Medium-term trend detection with:
            <ul style={{ textAlign: 'left', marginTop: '1rem' }}>
              <li>52-week high/low breakout tracker</li>
              <li>Support/Resistance level calculator</li>
              <li>Volume-confirmed breakout detection</li>
              <li>Moving average crossovers (50/200 day)</li>
              <li>Trend strength indicators (ADX, RSI, MACD)</li>
              <li>Trend reversal signal detection</li>
              <li>Swing trade portfolio manager</li>
              <li>Trailing stop-loss system</li>
              <li>Target achievement tracking</li>
              <li>Multi-timeframe analysis (daily/weekly)</li>
            </ul>
          </div>
          <div className="feature-badge">Premium Feature</div>
        </div>
      </div>

      {/* Feature Preview Cards */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">📈</div>
          </div>
          <div className="stat-card-label">Breakout Stocks</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">💹</div>
          </div>
          <div className="stat-card-label">Technical Indicators</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">📊</div>
          </div>
          <div className="stat-card-label">Swing Portfolio</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">🎯</div>
          </div>
          <div className="stat-card-label">Auto Trailing SL</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
