import React, { useState } from 'react';

export default function SectorScope() {
  const [viewType, setViewType] = useState('heatmap');

  const views = [
    { id: 'heatmap', label: 'Sector Heatmap' },
    { id: 'leaders', label: 'Leading Sectors' },
    { id: 'stocks', label: 'Top Stocks' },
    { id: 'rotation', label: 'Sector Rotation' }
  ];

  // Mock sector data for visual placeholder
  const sectors = [
    'Banking', 'IT', 'Auto', 'Pharma', 'Energy', 'FMCG',
    'Metals', 'Telecom', 'Realty', 'Media', 'Infra', 'PSU'
  ];

  return (
    <div className="product-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">🔍</span>
          <h2>Sector Scope</h2>
        </div>
        <p className="section-subtitle">
          Identify driving sectors and big-player stocks within those sectors
        </p>
      </div>

      {/* View Selector */}
      <div className="card">
        <h3>Select View</h3>
        <div className="view-buttons">
          {views.map(view => (
            <button
              key={view.id}
              className={`view-btn ${viewType === view.id ? 'active' : ''}`}
              onClick={() => setViewType(view.id)}
            >
              {view.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sector Preview Grid */}
      <div className="card">
        <h3>Sector Performance (Preview)</h3>
        <div className="sector-preview-grid">
          {sectors.map((sector, idx) => (
            <div key={sector} className="sector-preview-card" style={{ opacity: 0.5 }}>
              <div className="sector-name">{sector}</div>
              <div className="sector-change">---%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Coming Soon Placeholder */}
      <div className="coming-soon-section">
        <div className="empty-state">
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">Sector Scope - Coming Soon</div>
          <div className="empty-state-text">
            Comprehensive sector analysis featuring:
            <ul style={{ textAlign: 'left', marginTop: '1rem' }}>
              <li>Sector performance heatmap with visual indicators</li>
              <li>Relative strength comparison vs market</li>
              <li>Sector rotation detection and alerts</li>
              <li>Leading sector identification with momentum scoring</li>
              <li>Top performing stocks in leading sectors</li>
              <li>FII/DII institutional interest by sector</li>
              <li>Historical sector leadership patterns</li>
              <li>High-conviction trade recommendations</li>
            </ul>
          </div>
          <div className="feature-badge">Premium Feature</div>
        </div>
      </div>

      {/* Feature Preview Cards */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">🗺️</div>
          </div>
          <div className="stat-card-label">Sector Heatmap</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">📊</div>
          </div>
          <div className="stat-card-label">Rotation Tracker</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">🎯</div>
          </div>
          <div className="stat-card-label">Top Picks</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">💹</div>
          </div>
          <div className="stat-card-label">FII/DII Interest</div>
          <div className="stat-card-value" style={{ fontSize: '1rem', opacity: 0.6 }}>
            Coming Soon
          </div>
        </div>
      </div>
    </div>
  );
}
