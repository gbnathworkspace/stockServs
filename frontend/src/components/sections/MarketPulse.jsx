import React, { useState } from 'react';

export default function MarketPulse() {
  const [filterType, setFilterType] = useState('volume');

  const filters = [
    { id: 'volume', label: 'Volume Surge' },
    { id: 'smart-money', label: 'Smart Money' },
    { id: 'breakout', label: 'Breakouts' },
    { id: 'delivery', label: 'High Delivery' }
  ];

  return (
    <div className="product-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">💓</span>
          <h2>Market Pulse</h2>
        </div>
        <p className="section-subtitle">
          Identify stocks where big players are actively building positions
        </p>
      </div>

      {/* Filter Selector */}
      <div className="card">
        <h3>Stock Screener Filters</h3>
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
          <div className="empty-state-icon">💓</div>
          <div className="empty-state-title">Market Pulse - Coming Soon</div>
          <div className="empty-state-text">
            Detect institutional activity with:
            <ul style={{ textAlign: 'left', marginTop: '1rem' }}>
              <li>Smart money flow tracking and alerts</li>
              <li>Large block trade detection</li>
              <li>Delivery percentage analysis</li>
              <li>Unusual volume alerts with price correlation</li>
              <li>Breakout volume confirmation</li>
              <li>Accumulation/Distribution zone identification</li>
              <li>Order flow imbalance tracker</li>
              <li>Customizable stock screener</li>
            </ul>
          </div>
          <div className="feature-badge">Premium Feature</div>
        </div>
      </div>

      {/* Feature Preview Cards */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">🔍</div>
          </div>
          <div className="stat-card-label">Stock Screener</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">💰</div>
          </div>
          <div className="stat-card-label">Block Trades</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">📊</div>
          </div>
          <div className="stat-card-label">Volume Analysis</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">🚀</div>
          </div>
          <div className="stat-card-label">Real-time Alerts</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
