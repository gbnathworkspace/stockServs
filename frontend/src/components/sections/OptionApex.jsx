import React, { useState, useEffect } from 'react';
import { getAuthToken } from '../../lib/api';

export default function OptionApex() {
  const [timeframe, setTimeframe] = useState('5m');
  const [signalFilter, setSignalFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [signals, setSignals] = useState([]);
  const [timeframes, setTimeframes] = useState([]);
  const [error, setError] = useState(null);

  const signalTypes = [
    { id: 'all', label: 'All Signals', icon: '🎯' },
    { id: 'ENTRY', label: 'Entry Signals', icon: '🟢' },
    { id: 'EXIT', label: 'Exit Signals', icon: '🔴' }
  ];

  // Fetch timeframes on mount
  useEffect(() => {
    const fetchTimeframes = async () => {
      try {
        const token = getAuthToken();
        const response = await fetch('http://localhost:8000/option-apex/timeframes', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setTimeframes(data.timeframes || []);
        }
      } catch (err) {
        console.error('Error fetching timeframes:', err);
      }
    };

    fetchTimeframes();
  }, []);

  // Fetch signals data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = getAuthToken();
        const baseURL = 'http://localhost:8000';

        // Build signals URL with filters
        let signalsUrl = `${baseURL}/option-apex/signals/active?min_confidence=0`;
        if (signalFilter !== 'all') {
          signalsUrl += `&signal_type=${signalFilter}`;
        }

        const signalsResponse = await fetch(signalsUrl, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (signalsResponse.ok) {
          const signalsData = await signalsResponse.json();
          setSignals(signalsData.signals || []);
        }

      } catch (err) {
        console.error('Error fetching Option Apex data:', err);
        setError('Failed to load Option Apex data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [signalFilter]);

  // Render signals table
  const renderSignals = () => (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Type</th>
            <th>Direction</th>
            <th>Confidence</th>
            <th>Entry</th>
            <th>Target</th>
            <th>Stop Loss</th>
            <th>Generated</th>
          </tr>
        </thead>
        <tbody>
          {signals.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '2rem', opacity: 0.6 }}>
                No active signals found
              </td>
            </tr>
          ) : (
            signals.slice(0, 20).map((signal, index) => (
              <tr key={index}>
                <td className="symbol-cell">{signal.symbol}</td>
                <td>
                  <span className={`badge ${signal.signal_type === 'ENTRY' ? 'badge-green' : 'badge-red'}`}>
                    {signal.signal_type}
                  </span>
                </td>
                <td>
                  <span className={`badge ${signal.direction === 'BULLISH' ? 'badge-green' : 'badge-red'}`}>
                    {signal.direction}
                  </span>
                </td>
                <td>
                  <span className={`badge ${
                    signal.confidence_score >= 80 ? 'badge-green' :
                    signal.confidence_score >= 60 ? 'badge-blue' :
                    'badge-yellow'
                  }`}>
                    {signal.confidence_score?.toFixed(0)}%
                  </span>
                </td>
                <td>₹{signal.entry_level?.toFixed(2)}</td>
                <td>₹{signal.target_level?.toFixed(2)}</td>
                <td>₹{signal.stop_loss_level?.toFixed(2)}</td>
                <td style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                  {signal.generated_at ? new Date(signal.generated_at).toLocaleTimeString() : '-'}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // Calculate stats from signals
  const entrySignals = signals.filter(s => s.signal_type === 'ENTRY');
  const exitSignals = signals.filter(s => s.signal_type === 'EXIT');
  const bullishSignals = signals.filter(s => s.direction === 'BULLISH');
  const highConfidence = signals.filter(s => s.confidence_score >= 80);

  return (
    <div className="product-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">⚡</span>
          <h2>Option Apex</h2>
        </div>
        <p className="section-subtitle">
          Real-time option candle analysis with institutional flow detection
        </p>
      </div>

      {/* Stats Summary */}
      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">🟢</div>
          </div>
          <div className="stat-card-label">Entry Signals</div>
          <div className="stat-card-value">{entrySignals.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon red">🔴</div>
          </div>
          <div className="stat-card-label">Exit Signals</div>
          <div className="stat-card-value">{exitSignals.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon blue">📈</div>
          </div>
          <div className="stat-card-label">Bullish Signals</div>
          <div className="stat-card-value">{bullishSignals.length}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div className="stat-card-icon green">⭐</div>
          </div>
          <div className="stat-card-label">High Confidence (80+)</div>
          <div className="stat-card-value">{highConfidence.length}</div>
        </div>
      </div>

      {/* Timeframe Selector */}
      <div className="card" style={{ marginTop: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Select Timeframe</h3>
        <div className="filter-buttons">
          {timeframes.length > 0 ? (
            timeframes.map(tf => (
              <button
                key={tf.value}
                className={`filter-btn ${timeframe === tf.value ? 'active' : ''}`}
                onClick={() => setTimeframe(tf.value)}
              >
                <span style={{ marginRight: '0.5rem' }}>📊</span>
                {tf.label}
              </button>
            ))
          ) : (
            <>
              <button
                className={`filter-btn ${timeframe === '1m' ? 'active' : ''}`}
                onClick={() => setTimeframe('1m')}
              >
                <span style={{ marginRight: '0.5rem' }}>📊</span>
                1 Minute
              </button>
              <button
                className={`filter-btn ${timeframe === '5m' ? 'active' : ''}`}
                onClick={() => setTimeframe('5m')}
              >
                <span style={{ marginRight: '0.5rem' }}>📊</span>
                5 Minutes
              </button>
              <button
                className={`filter-btn ${timeframe === '15m' ? 'active' : ''}`}
                onClick={() => setTimeframe('15m')}
              >
                <span style={{ marginRight: '0.5rem' }}>📊</span>
                15 Minutes
              </button>
              <button
                className={`filter-btn ${timeframe === '30m' ? 'active' : ''}`}
                onClick={() => setTimeframe('30m')}
              >
                <span style={{ marginRight: '0.5rem' }}>📊</span>
                30 Minutes
              </button>
            </>
          )}
        </div>
      </div>

      {/* Signal Type Filter */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Filter Signals</h3>
        <div className="filter-buttons">
          {signalTypes.map(type => (
            <button
              key={type.id}
              className={`filter-btn ${signalFilter === type.id ? 'active' : ''}`}
              onClick={() => setSignalFilter(type.id)}
            >
              <span style={{ marginRight: '0.5rem' }}>{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active Signals Table */}
      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>Active Signals</h3>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>
            Loading Option Apex signals...
          </div>
        ) : error ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--danger)', opacity: 0.8 }}>
            {error}
          </div>
        ) : (
          renderSignals()
        )}
      </div>

      {/* Information Panel */}
      <div className="card" style={{ marginTop: '1rem', padding: '1.5rem' }}>
        <h3 style={{ marginBottom: '1rem' }}>How Option Apex Works</h3>
        <div style={{ lineHeight: '1.8', opacity: 0.9 }}>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>Timeframe Analysis:</strong> Select your preferred candle interval (1m, 5m, 15m, 30m) to match your trading style.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>Signal Types:</strong> Entry signals identify new opportunities, while Exit signals suggest profit booking or position closures.
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>Confidence Score:</strong> Based on OI buildup, volume spikes, IV changes, and institutional flow patterns (0-100%).
          </p>
          <p style={{ marginBottom: '0.75rem' }}>
            <strong>Direction:</strong> Bullish signals suggest buying calls/selling puts. Bearish signals suggest buying puts/selling calls.
          </p>
          <p>
            <strong>Levels:</strong> Entry, Target, and Stop Loss levels are calculated using risk-reward ratios and volatility analysis.
          </p>
        </div>
      </div>
    </div>
  );
}
