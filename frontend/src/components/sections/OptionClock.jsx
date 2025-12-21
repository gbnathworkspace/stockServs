import React, { useState } from 'react';

export default function OptionClock() {
  const [selectedTimeframe, setSelectedTimeframe] = useState('9:15-10:00');

  const timeframes = [
    '9:15-10:00', '10:00-11:00', '11:00-12:00',
    '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-15:30'
  ];

  return (
    <div className="product-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">🕐</span>
          <h2>Option Clock</h2>
        </div>
        <p className="section-subtitle">
          Select timeframe to reveal major player moves in options market
        </p>
      </div>

      {/* Timeframe Selector */}
      <div className="card">
        <h3>Select Trading Timeframe</h3>
        <div className="timeframe-grid">
          {timeframes.map(time => (
            <button
              key={time}
              className={`timeframe-btn ${selectedTimeframe === time ? 'active' : ''}`}
              onClick={() => setSelectedTimeframe(time)}
            >
              {time}
            </button>
          ))}
        </div>
      </div>

      {/* Coming Soon Placeholder */}
      <div className="coming-soon-section">
        <div className="empty-state">
          <div className="empty-state-icon">🕐</div>
          <div className="empty-state-title">Option Clock - Coming Soon</div>
          <div className="empty-state-text">
            This powerful feature will show you:
            <ul style={{ textAlign: 'left', marginTop: '1rem' }}>
              <li>Major player option trades in selected timeframe</li>
              <li>Open Interest buildup and decay patterns</li>
              <li>Unusual volume spikes in calls and puts</li>
              <li>Net position analysis (Long/Short Call/Put)</li>
              <li>Heatmap visualization of OI concentration</li>
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
          <div className="stat-card-label">Options Chain Display</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">🔥</div>
          </div>
          <div className="stat-card-label">Volume Spike Detection</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">📈</div>
          </div>
          <div className="stat-card-label">OI Buildup Tracker</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">🎯</div>
          </div>
          <div className="stat-card-label">Position Analysis</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
