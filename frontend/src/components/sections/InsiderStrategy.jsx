import React, { useState } from 'react';

export default function InsiderStrategy() {
  const [strategyType, setStrategyType] = useState('all');

  const strategies = [
    { id: 'all', label: 'All Strategies' },
    { id: 'breakout', label: 'Breakout Plays' },
    { id: 'reversal', label: 'Reversal Patterns' },
    { id: 'momentum', label: 'Momentum Stocks' }
  ];

  return (
    <div className="product-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">🎯</span>
          <h2>Insider Strategy</h2>
        </div>
        <p className="section-subtitle">
          Analyze stocks based on proven market structures: price, volume, and OI growth
        </p>
      </div>

      {/* Strategy Selector */}
      <div className="card">
        <h3>Select Strategy Type</h3>
        <div className="strategy-buttons">
          {strategies.map(strategy => (
            <button
              key={strategy.id}
              className={`strategy-btn ${strategyType === strategy.id ? 'active' : ''}`}
              onClick={() => setStrategyType(strategy.id)}
            >
              {strategy.label}
            </button>
          ))}
        </div>
      </div>

      {/* Coming Soon Placeholder */}
      <div className="coming-soon-section">
        <div className="empty-state">
          <div className="empty-state-icon">🎯</div>
          <div className="empty-state-title">Insider Strategy - Coming Soon</div>
          <div className="empty-state-text">
            High-reward trade identification with:
            <ul style={{ textAlign: 'left', marginTop: '1rem' }}>
              <li>Multi-factor scoring engine (Price + Volume + OI)</li>
              <li>Pattern recognition (Cup & Handle, Flags, H&S)</li>
              <li>Volume growth and OI growth tracking</li>
              <li>VWAP and volume surge detection</li>
              <li>Risk-reward calculator with target projections</li>
              <li>Optimal stop-loss recommendations</li>
              <li>Backtesting engine with historical accuracy</li>
              <li>Win rate and P/L statistics</li>
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
          <div className="stat-card-label">Pattern Detection</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">💹</div>
          </div>
          <div className="stat-card-label">Multi-Factor Score</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">🎯</div>
          </div>
          <div className="stat-card-label">Backtesting Results</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">📊</div>
          </div>
          <div className="stat-card-label">Risk-Reward Analysis</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
