import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../../lib/api';

export default function InsiderStrategy() {
  const [gradeFilter, setGradeFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [picks, setPicks] = useState([]);
  const [gradeDistribution, setGradeDistribution] = useState(null);
  const [performance, setPerformance] = useState(null);
  const [error, setError] = useState(null);

  const grades = [
    { id: 'all', label: 'All Grades', icon: '🎯', color: 'blue' },
    { id: 'A', label: 'Grade A (80+)', icon: '⭐', color: 'green' },
    { id: 'B', label: 'Grade B (60-79)', icon: '💎', color: 'blue' },
    { id: 'C', label: 'Grade C (40-59)', icon: '📊', color: 'yellow' },
    { id: 'D', label: 'Grade D (<40)', icon: '📉', color: 'gray' }
  ];

  // Fetch Insider Strategy data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = getAuthToken();
        const baseURL = 'http://localhost:8000';

        // Fetch picks based on grade filter
        let picksUrl = `${baseURL}/insider-strategy/picks/active`;
        if (gradeFilter !== 'all') {
          picksUrl = `${baseURL}/insider-strategy/top-picks?grade=${gradeFilter}&limit=20`;
        }

        const picksResponse = await fetch(picksUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (picksResponse.ok) {
          const picksData = await picksResponse.json();
          setPicks(picksData.picks || []);
        }

        // Fetch grade distribution
        const distResponse = await fetch(`${baseURL}/insider-strategy/grade-distribution`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (distResponse.ok) {
          const distData = await distResponse.json();
          setGradeDistribution(distData);
        }

        // Fetch performance metrics
        const perfResponse = await fetch(`${baseURL}/insider-strategy/performance`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (perfResponse.ok) {
          const perfData = await perfResponse.json();
          setPerformance(perfData);
        }

      } catch (err) {
        console.error('Error fetching Insider Strategy data:', err);
        setError('Failed to load Insider Strategy data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [gradeFilter]);

  // Render picks table
  const renderPicks = () => (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Grade</th>
            <th>Composite Score</th>
            <th>Type</th>
            <th>Entry</th>
            <th>Target</th>
            <th>Stop Loss</th>
            <th>R:R</th>
          </tr>
        </thead>
        <tbody>
          {picks.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                No picks found for selected grade
              </td>
            </tr>
          ) : (
            picks.slice(0, 20).map((pick, index) => (
              <tr key={index}>
                <td className="symbol-cell">{pick.symbol}</td>
                <td>
                  <span className={`badge ${
                    pick.grade === 'A' ? 'badge-green' :
                    pick.grade === 'B' ? 'badge-blue' :
                    pick.grade === 'C' ? 'badge-yellow' :
                    'badge-gray'
                  }`}>
                    {pick.grade}
                  </span>
                </td>
                <td>
                  <span className="badge badge-blue">
                    {pick.composite_score?.toFixed(1)}
                  </span>
                </td>
                <td>
                  <span className={`badge ${pick.pick_type === 'BULLISH' ? 'badge-green' : 'badge-red'}`}>
                    {pick.pick_type}
                  </span>
                </td>
                <td>₹{pick.entry_price?.toFixed(2)}</td>
                <td>₹{pick.target_price?.toFixed(2)}</td>
                <td>₹{pick.stop_loss?.toFixed(2)}</td>
                <td>
                  <span className="badge badge-green">
                    {pick.risk_reward_ratio?.toFixed(1)}:1
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // Render score breakdown for expanded view
  const renderScoreBreakdown = () => {
    if (picks.length === 0) return null;

    const topPick = picks[0];
    return (
      <div className="card" style={{ marginTop: '1rem', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Top Pick Score Breakdown: {topPick.symbol}</h3>
        <div className="dashboard-grid">
          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon blue">📈</div>
            </div>
            <div className="stat-card-label">Momentum Score (40%)</div>
            <div className="stat-card-value">{topPick.momentum_score?.toFixed(1)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon green">📊</div>
            </div>
            <div className="stat-card-label">Volume Score (30%)</div>
            <div className="stat-card-value">{topPick.volume_score?.toFixed(1)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon orange">💹</div>
            </div>
            <div className="stat-card-label">OI Score (30%)</div>
            <div className="stat-card-value">{topPick.oi_score?.toFixed(1)}</div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <div className="stat-card-icon blue">⭐</div>
            </div>
            <div className="stat-card-label">Composite Score</div>
            <div className="stat-card-value">{topPick.composite_score?.toFixed(1)}</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="product-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">🎯</span>
          <h2>Insider Strategy</h2>
        </div>
        <p className="section-subtitle">
          Multi-factor composite scoring: Momentum (40%) + Volume (30%) + OI (30%)
        </p>
      </div>

      {/* Stats Summary */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">⭐</div>
          </div>
          <div className="stat-card-label">Grade A Picks</div>
          <div className="stat-card-value">
            {(Array.isArray(gradeDistribution?.distribution)
              ? gradeDistribution.distribution.find(g => g.grade === 'A')?.count
              : 0) || 0}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">💎</div>
          </div>
          <div className="stat-card-label">Grade B Picks</div>
          <div className="stat-card-value">
            {(Array.isArray(gradeDistribution?.distribution)
              ? gradeDistribution.distribution.find(g => g.grade === 'B')?.count
              : 0) || 0}
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon yellow">📊</div>
          </div>
          <div className="stat-card-label">Total Active Picks</div>
          <div className="stat-card-value">{gradeDistribution?.total_picks || 0}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">🎯</div>
          </div>
          <div className="stat-card-label">Avg Accuracy</div>
          <div className="stat-card-value">
            {performance?.overall?.avg_accuracy?.toFixed(1) || 0}%
          </div>
        </div>
      </div>

      {/* Grade Filter Selector */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="filter-buttons">
          {grades.map(grade => (
            <button
              key={grade.id}
              className={`filter-btn ${gradeFilter === grade.id ? 'active' : ''}`}
              onClick={() => setGradeFilter(grade.id)}
            >
              <span style={{ marginRight: '0.5rem' }}>{grade.icon}</span>
              {grade.label}
            </button>
          ))}
        </div>
      </div>

      {/* Score Breakdown for Top Pick */}
      {!loading && !error && picks.length > 0 && renderScoreBreakdown()}

      {/* Picks Table */}
      <div className="card" style={{ marginTop: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>
            Loading Insider Strategy picks...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--danger)', opacity: 0.8 }}>
            {error}
          </div>
        ) : (
          renderPicks()
        )}
      </div>

      {/* Performance Metrics */}
      {performance && performance.overall && (
        <div className="card" style={{ marginTop: '1rem', padding: '1.5rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Performance Metrics</h3>
          <div className="dashboard-grid">
            <div className="stat-card">
              <div className="stat-card-label">Total Trades</div>
              <div className="stat-card-value">{performance.overall.total_trades}</div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Winning Trades</div>
              <div className="stat-card-value" style={{ color: 'var(--success)' }}>
                {performance.overall.winning_trades}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Losing Trades</div>
              <div className="stat-card-value" style={{ color: 'var(--danger)' }}>
                {performance.overall.losing_trades}
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-card-label">Avg Return</div>
              <div className="stat-card-value" style={{
                color: performance.overall.avg_return >= 0 ? 'var(--success)' : 'var(--danger)'
              }}>
                {performance.overall.avg_return?.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
