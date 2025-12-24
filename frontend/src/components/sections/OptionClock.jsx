import React, { useState, useEffect, useRef } from 'react';
import { authApi, fastAuthApi } from '../../lib/api.js';
import useAutoRefresh, { useRelativeTime } from '../../hooks/useAutoRefresh';

const API_BASE_URL = window.location.origin;

/**
 * OptionClock - OI-based market timing tool
 * Shows PCR, signals, and key strike levels for NIFTY and BANKNIFTY
 */
export default function OptionClock() {
  const [selectedSymbol, setSelectedSymbol] = useState('NIFTY');
  const [overview, setOverview] = useState(null);
  const [intradayData, setIntradayData] = useState([]);
  const [strikeData, setStrikeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isInitialMount = useRef(true);

  // Auto-refresh every 60 seconds
  const { lastUpdate } = useAutoRefresh('option-clock', () => refreshDataSilent(), 60000);
  const lastUpdateTime = useRelativeTime(lastUpdate);

  useEffect(() => {
    loadData();
  }, [selectedSymbol]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewRes, intradayRes, strikeRes] = await Promise.all([
        authApi(`${API_BASE_URL}/option-clock/overview`),
        authApi(`${API_BASE_URL}/option-clock/intraday/${selectedSymbol}`),
        authApi(`${API_BASE_URL}/option-clock/strike-analysis/${selectedSymbol}`),
      ]);

      setOverview(overviewRes);
      setIntradayData(intradayRes?.snapshots || []);
      setStrikeData(strikeRes);
    } catch (err) {
      console.error('Failed to load Option Clock data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      isInitialMount.current = false;
    }
  };

  const refreshDataSilent = async () => {
    try {
      const res = await fastAuthApi(`${API_BASE_URL}/option-clock/overview`);
      if (res) setOverview(res);
    } catch (err) {
      console.error('Silent refresh failed:', err);
    }
  };

  // Get signal color class
  const getSignalColor = (signal) => {
    switch (signal) {
      case 'LONG_BUILDUP': return 'bullish';
      case 'SHORT_COVERING': return 'bullish';
      case 'SHORT_BUILDUP': return 'bearish';
      case 'LONG_UNWINDING': return 'bearish';
      default: return 'neutral';
    }
  };

  // Get signal description
  const getSignalDescription = (signal) => {
    switch (signal) {
      case 'LONG_BUILDUP': return 'Price + OI Rising - Fresh Buying';
      case 'SHORT_COVERING': return 'Price Rising, OI Falling - Short Exit';
      case 'SHORT_BUILDUP': return 'Price Falling, OI Rising - Fresh Selling';
      case 'LONG_UNWINDING': return 'Price + OI Falling - Long Exit';
      default: return 'No clear signal';
    }
  };

  // Format signal for display
  const formatSignal = (signal) => {
    if (!signal) return 'N/A';
    return signal.replace(/_/g, ' ');
  };

  // Get PCR interpretation
  const getPcrInterpretation = (pcr) => {
    if (!pcr) return { text: 'No Data', color: 'neutral' };
    if (pcr > 1.5) return { text: 'Heavy Put Writing - Bullish', color: 'bullish' };
    if (pcr > 1.2) return { text: 'Put Heavy - Moderate Bullish', color: 'bullish' };
    if (pcr < 0.7) return { text: 'Heavy Call Writing - Bearish', color: 'bearish' };
    if (pcr < 0.9) return { text: 'Call Heavy - Moderate Bearish', color: 'bearish' };
    return { text: 'Balanced - Neutral', color: 'neutral' };
  };

  // Get data for the currently selected symbol
  const currentData = overview?.[selectedSymbol.toLowerCase()];

  // Render loading state
  if (loading && isInitialMount.current) {
    return (
      <div className="product-section">
        <div className="section-header">
          <div className="section-title">
            <span className="section-title-icon">&#128336;</span>
            <h2>Option Clock</h2>
          </div>
        </div>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading Option Clock data...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error && !currentData) {
    return (
      <div className="product-section">
        <div className="section-header">
          <div className="section-title">
            <span className="section-title-icon">&#128336;</span>
            <h2>Option Clock</h2>
          </div>
        </div>
        <div className="error-container">
          <div className="error-message">
            <span className="error-icon">&#9888;</span>
            <p>{error}</p>
            <button className="refresh-btn" onClick={loadData}>Retry</button>
          </div>
        </div>
      </div>
    );
  }

  const pcrInfo = getPcrInterpretation(currentData?.pcr);

  return (
    <div className="product-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">&#128336;</span>
          <h2>Option Clock</h2>
        </div>
        <p className="section-subtitle">
          OI-based market timing - Last updated: {lastUpdateTime}
        </p>
      </div>

      {/* Symbol Selector */}
      <div className="card symbol-selector-card">
        <div className="symbol-toggle">
          <button
            className={`symbol-btn ${selectedSymbol === 'NIFTY' ? 'active' : ''}`}
            onClick={() => setSelectedSymbol('NIFTY')}
          >
            NIFTY 50
          </button>
          <button
            className={`symbol-btn ${selectedSymbol === 'BANKNIFTY' ? 'active' : ''}`}
            onClick={() => setSelectedSymbol('BANKNIFTY')}
          >
            BANK NIFTY
          </button>
        </div>
      </div>

      {!currentData ? (
        <div className="empty-state">
          <div className="empty-state-icon">&#128336;</div>
          <div className="empty-state-title">No Data Available</div>
          <div className="empty-state-text">
            Option Clock data will be available during market hours.
            <br />
            Data is fetched every 15 minutes between 9:15 AM - 3:30 PM.
          </div>
        </div>
      ) : (
        <>
          {/* Main Signal Card */}
          <div className={`signal-card ${getSignalColor(currentData.signal)}`}>
            <div className="signal-header">
              <span className="signal-label">Current Signal</span>
              <span className={`signal-badge ${getSignalColor(currentData.signal)}`}>
                {currentData.signal_strength}
              </span>
            </div>
            <div className="signal-value">{formatSignal(currentData.signal)}</div>
            <div className="signal-description">
              {getSignalDescription(currentData.signal)}
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="dashboard-grid">
            {/* Spot Price Card */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon blue">&#128200;</div>
              </div>
              <div className="stat-card-label">{selectedSymbol} Spot</div>
              <div className="stat-card-value">
                {currentData.spot_price?.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
              </div>
              <div className={`stat-card-change ${currentData.price_change >= 0 ? 'positive' : 'negative'}`}>
                {currentData.price_change >= 0 ? '+' : ''}
                {currentData.price_change?.toFixed(2)} ({currentData.price_change_pct?.toFixed(2)}%)
              </div>
            </div>

            {/* PCR Card */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className={`stat-card-icon ${pcrInfo.color === 'bullish' ? 'green' : pcrInfo.color === 'bearish' ? 'red' : 'blue'}`}>
                  &#9878;
                </div>
              </div>
              <div className="stat-card-label">Put-Call Ratio</div>
              <div className="stat-card-value">{currentData.pcr?.toFixed(3) || 'N/A'}</div>
              <div className={`stat-card-change ${pcrInfo.color}`}>
                {pcrInfo.text}
              </div>
            </div>

            {/* Max Pain Card */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon orange">&#127919;</div>
              </div>
              <div className="stat-card-label">Max Pain Strike</div>
              <div className="stat-card-value">
                {currentData.max_pain_strike?.toLocaleString('en-IN') || 'N/A'}
              </div>
              <div className="stat-card-change neutral">
                Expected expiry level
              </div>
            </div>

            {/* Timestamp Card */}
            <div className="stat-card">
              <div className="stat-card-header">
                <div className="stat-card-icon blue">&#9200;</div>
              </div>
              <div className="stat-card-label">Data Timestamp</div>
              <div className="stat-card-value" style={{ fontSize: '1rem' }}>
                {currentData.timestamp ? new Date(currentData.timestamp).toLocaleTimeString('en-IN') : 'N/A'}
              </div>
              <div className="stat-card-change neutral">
                Updates every 15 min
              </div>
            </div>
          </div>

          {/* Strike Levels Section */}
          {strikeData && (
            <div className="card strike-levels-card">
              <h3>Key Strike Levels</h3>
              <div className="strike-levels-grid">
                <div className="strike-level-item support">
                  <span className="strike-label">Highest Put OI (Support)</span>
                  <span className="strike-value">
                    {strikeData.highest_put_oi_strike?.toLocaleString('en-IN') || 'N/A'}
                  </span>
                </div>
                <div className="strike-level-item current">
                  <span className="strike-label">Current Spot</span>
                  <span className="strike-value">
                    {strikeData.spot_price?.toLocaleString('en-IN', { maximumFractionDigits: 2 }) || 'N/A'}
                  </span>
                </div>
                <div className="strike-level-item resistance">
                  <span className="strike-label">Highest Call OI (Resistance)</span>
                  <span className="strike-value">
                    {strikeData.highest_call_oi_strike?.toLocaleString('en-IN') || 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Intraday PCR Timeline */}
          {intradayData.length > 0 && (
            <div className="card intraday-timeline-card">
              <h3>Today's PCR Timeline</h3>
              <div className="pcr-timeline">
                {intradayData.slice(-10).map((snapshot, index) => (
                  <div
                    key={index}
                    className={`timeline-item ${getSignalColor(snapshot.signal)}`}
                    title={`${new Date(snapshot.timestamp).toLocaleTimeString()} - ${formatSignal(snapshot.signal)}`}
                  >
                    <div className="timeline-time">
                      {new Date(snapshot.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="timeline-pcr">{snapshot.pcr?.toFixed(2)}</div>
                    <div className={`timeline-signal ${getSignalColor(snapshot.signal)}`}>
                      {snapshot.signal?.split('_')[0]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Strike-wise OI Table */}
          {strikeData?.strikes && strikeData.strikes.length > 0 && (
            <div className="card strike-table-card">
              <h3>Strike-wise Open Interest</h3>
              <div className="strike-table-container">
                <table className="strike-table">
                  <thead>
                    <tr>
                      <th>Call OI</th>
                      <th>Call Chg</th>
                      <th>Strike</th>
                      <th>Put Chg</th>
                      <th>Put OI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {strikeData.strikes
                      .filter(s => Math.abs(s.strike - strikeData.spot_price) <= 500)
                      .map((strike, index) => (
                        <tr
                          key={index}
                          className={strike.is_atm ? 'atm-row' : ''}
                        >
                          <td className={strike.is_resistance ? 'highlight-cell bearish' : ''}>
                            {(strike.call_oi / 100000).toFixed(1)}L
                          </td>
                          <td className={strike.call_oi_change > 0 ? 'positive' : strike.call_oi_change < 0 ? 'negative' : ''}>
                            {strike.call_oi_change > 0 ? '+' : ''}{(strike.call_oi_change / 100000).toFixed(2)}L
                          </td>
                          <td className="strike-col">{strike.strike}</td>
                          <td className={strike.put_oi_change > 0 ? 'positive' : strike.put_oi_change < 0 ? 'negative' : ''}>
                            {strike.put_oi_change > 0 ? '+' : ''}{(strike.put_oi_change / 100000).toFixed(2)}L
                          </td>
                          <td className={strike.is_support ? 'highlight-cell bullish' : ''}>
                            {(strike.put_oi / 100000).toFixed(1)}L
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Signal Legend */}
          <div className="card signal-legend-card">
            <h3>Signal Legend</h3>
            <div className="signal-legend-grid">
              <div className="legend-item">
                <span className="legend-dot bullish"></span>
                <span className="legend-text">
                  <strong>Long Buildup:</strong> Bullish - Fresh buying (Price + OI rising)
                </span>
              </div>
              <div className="legend-item">
                <span className="legend-dot bullish"></span>
                <span className="legend-text">
                  <strong>Short Covering:</strong> Weak Bullish - Shorts exiting (Price rising, OI falling)
                </span>
              </div>
              <div className="legend-item">
                <span className="legend-dot bearish"></span>
                <span className="legend-text">
                  <strong>Short Buildup:</strong> Bearish - Fresh selling (Price falling, OI rising)
                </span>
              </div>
              <div className="legend-item">
                <span className="legend-dot bearish"></span>
                <span className="legend-text">
                  <strong>Long Unwinding:</strong> Weak Bearish - Longs exiting (Price + OI falling)
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
