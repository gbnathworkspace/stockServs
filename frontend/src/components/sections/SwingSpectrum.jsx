import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../../lib/api';

export default function SwingSpectrum() {
  const [filterType, setFilterType] = useState('breakouts-high');
  const [loading, setLoading] = useState(true);
  const [breakoutsHigh, setBreakoutsHigh] = useState([]);
  const [breakoutsLow, setBreakoutsLow] = useState([]);
  const [momentum, setMomentum] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);

  const filters = [
    { id: 'breakouts-high', label: '52W High Breakouts', icon: '📈' },
    { id: 'breakouts-low', label: '52W Low Breakouts', icon: '📉' },
    { id: 'momentum', label: 'High Momentum', icon: '💹' }
  ];

  // Fetch Swing Spectrum data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = getAuthToken();
        const baseURL = 'http://localhost:8000';

        // Fetch 52-week high breakouts
        const highResponse = await fetch(`${baseURL}/swing-spectrum/breakouts?type=high&min_distance=0`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (highResponse.ok) {
          const highData = await highResponse.json();
          setBreakoutsHigh(highData.breakouts || []);
        }

        // Fetch 52-week low breakouts
        const lowResponse = await fetch(`${baseURL}/swing-spectrum/breakouts?type=low&min_distance=0`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (lowResponse.ok) {
          const lowData = await lowResponse.json();
          setBreakoutsLow(lowData.breakouts || []);
        }

        // Fetch momentum stocks
        const momentumResponse = await fetch(`${baseURL}/swing-spectrum/momentum?min_score=70`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (momentumResponse.ok) {
          const momentumData = await momentumResponse.json();
          setMomentum(momentumData.stocks || []);
        }

        // Fetch stats
        const statsResponse = await fetch(`${baseURL}/swing-spectrum/stats`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (statsResponse.ok) {
          const statsData = await statsResponse.json();
          setStats(statsData);
        }

      } catch (err) {
        console.error('Error fetching Swing Spectrum data:', err);
        setError('Failed to load Swing Spectrum data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, []);

  // Render 52-week high breakouts
  const renderBreakoutsHigh = () => (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Price</th>
            <th>Change %</th>
            <th>Distance from 52W High</th>
            <th>Volume Ratio</th>
            <th>Strength</th>
          </tr>
        </thead>
        <tbody>
          {breakoutsHigh.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                No 52-week high breakouts found
              </td>
            </tr>
          ) : (
            breakoutsHigh.slice(0, 20).map((stock, index) => (
              <tr key={index}>
                <td className="symbol-cell">{stock.symbol}</td>
                <td>₹{stock.ltp?.toFixed(2)}</td>
                <td className={stock.priceChangePct >= 0 ? 'positive' : 'negative'}>
                  {stock.priceChangePct >= 0 ? '+' : ''}{stock.priceChangePct?.toFixed(2)}%
                </td>
                <td>
                  <span className="badge badge-green">
                    {stock.distanceFrom52WHigh?.toFixed(2)}%
                  </span>
                </td>
                <td>
                  <span className="badge badge-blue">
                    {stock.volumeRatio?.toFixed(1)}x
                  </span>
                </td>
                <td>
                  <span className={`badge ${
                    stock.breakoutStrength === 'STRONG' ? 'badge-green' :
                    stock.breakoutStrength === 'MODERATE' ? 'badge-yellow' :
                    'badge-gray'
                  }`}>
                    {stock.breakoutStrength}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // Render 52-week low breakouts
  const renderBreakoutsLow = () => (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Price</th>
            <th>Change %</th>
            <th>Distance from 52W Low</th>
            <th>Volume Ratio</th>
            <th>Strength</th>
          </tr>
        </thead>
        <tbody>
          {breakoutsLow.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                No 52-week low breakouts found
              </td>
            </tr>
          ) : (
            breakoutsLow.slice(0, 20).map((stock, index) => (
              <tr key={index}>
                <td className="symbol-cell">{stock.symbol}</td>
                <td>₹{stock.ltp?.toFixed(2)}</td>
                <td className={stock.priceChangePct >= 0 ? 'positive' : 'negative'}>
                  {stock.priceChangePct >= 0 ? '+' : ''}{stock.priceChangePct?.toFixed(2)}%
                </td>
                <td>
                  <span className="badge badge-red">
                    {stock.distanceFrom52WLow?.toFixed(2)}%
                  </span>
                </td>
                <td>
                  <span className="badge badge-blue">
                    {stock.volumeRatio?.toFixed(1)}x
                  </span>
                </td>
                <td>
                  <span className={`badge ${
                    stock.breakoutStrength === 'STRONG' ? 'badge-green' :
                    stock.breakoutStrength === 'MODERATE' ? 'badge-yellow' :
                    'badge-gray'
                  }`}>
                    {stock.breakoutStrength}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // Render momentum stocks
  const renderMomentum = () => (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Price</th>
            <th>Change %</th>
            <th>Momentum Score</th>
            <th>Volume Ratio</th>
            <th>Trend</th>
          </tr>
        </thead>
        <tbody>
          {momentum.length === 0 ? (
            <tr>
              <td colSpan="6" style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                No high momentum stocks found
              </td>
            </tr>
          ) : (
            momentum.slice(0, 20).map((stock, index) => (
              <tr key={index}>
                <td className="symbol-cell">{stock.symbol}</td>
                <td>₹{stock.ltp?.toFixed(2)}</td>
                <td className={stock.priceChangePct >= 0 ? 'positive' : 'negative'}>
                  {stock.priceChangePct >= 0 ? '+' : ''}{stock.priceChangePct?.toFixed(2)}%
                </td>
                <td>
                  <span className="badge badge-green">
                    {stock.momentumScore?.toFixed(0)}
                  </span>
                </td>
                <td>
                  <span className="badge badge-blue">
                    {stock.volumeRatio?.toFixed(1)}x
                  </span>
                </td>
                <td>
                  <span className={`badge ${stock.trend === 'BULLISH' ? 'badge-green' : 'badge-red'}`}>
                    {stock.trend}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

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

      {/* Stats Summary */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">📈</div>
          </div>
          <div className="stat-card-label">52W High Breakouts</div>
          <div className="stat-card-value">{breakoutsHigh.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon red">📉</div>
          </div>
          <div className="stat-card-label">52W Low Breakouts</div>
          <div className="stat-card-value">{breakoutsLow.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">💹</div>
          </div>
          <div className="stat-card-label">High Momentum</div>
          <div className="stat-card-value">{momentum.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">🎯</div>
          </div>
          <div className="stat-card-label">Strong Breakouts</div>
          <div className="stat-card-value">
            {breakoutsHigh.filter(s => s.breakoutStrength === 'STRONG').length}
          </div>
        </div>
      </div>

      {/* Filter Selector */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="filter-buttons">
          {filters.map(filter => (
            <button
              key={filter.id}
              className={`filter-btn ${filterType === filter.id ? 'active' : ''}`}
              onClick={() => setFilterType(filter.id)}
            >
              <span style={{ marginRight: '0.5rem' }}>{filter.icon}</span>
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      {/* Data Display */}
      <div className="card" style={{ marginTop: '1rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>
            Loading Swing Spectrum data...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--danger)', opacity: 0.8 }}>
            {error}
          </div>
        ) : (
          <>
            {filterType === 'breakouts-high' && renderBreakoutsHigh()}
            {filterType === 'breakouts-low' && renderBreakoutsLow()}
            {filterType === 'momentum' && renderMomentum()}
          </>
        )}
      </div>
    </div>
  );
}
