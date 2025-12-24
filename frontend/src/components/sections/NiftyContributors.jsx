import React, { useState, useEffect, useMemo, useRef } from 'react';
import { authApi, fastAuthApi } from '../../lib/api.js';
import useAutoRefresh, { useRelativeTime } from '../../hooks/useAutoRefresh';
import ContributorCard from '../ContributorCard';
import MarketStrengthIndicator from '../MarketStrengthIndicator';
import { processContributorData } from '../../utils/indexContribution';

const API_BASE_URL = window.location.origin;

/**
 * NiftyContributors - Index Movers & Draggers Dashboard
 * Shows which stocks are lifting vs dragging the Nifty index
 * Sorted by contribution points (not percentage), with OI-based signal tagging
 */
export default function NiftyContributors() {
  const [stocksData, setStocksData] = useState([]);
  const [niftyLevel, setNiftyLevel] = useState(24500);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isInitialMount = useRef(true);

  // Auto-refresh every 5 seconds
  const { lastUpdate } = useAutoRefresh('nifty-contributors', () => refreshDataSilent(), 5000);
  const lastUpdateTime = useRelativeTime(lastUpdate);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch Nifty 50 data and index level in parallel
      const [stocksRes, indicesRes] = await Promise.all([
        authApi(`${API_BASE_URL}/nse_data/nifty-contributors`),
        authApi(`${API_BASE_URL}/nse_data/indices`).catch(() => null),
      ]);

      if (stocksRes?.stocks) {
        setStocksData(stocksRes.stocks);
      }

      // Get current Nifty level from indices
      if (indicesRes?.indices) {
        const nifty50 = indicesRes.indices.find(i =>
          i.index === 'NIFTY 50' || i.indexSymbol === 'NIFTY 50'
        );
        if (nifty50?.last || nifty50?.lastPrice) {
          setNiftyLevel(nifty50.last || nifty50.lastPrice);
        }
      }
    } catch (err) {
      console.error('Failed to load Nifty contributors:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      isInitialMount.current = false;
    }
  };

  const refreshDataSilent = async () => {
    const res = await fastAuthApi(`${API_BASE_URL}/nse_data/nifty-contributors`);
    if (res?.stocks) {
      setStocksData(res.stocks);
    }
  };

  // Process data into movers and draggers
  const processedData = useMemo(() => {
    return processContributorData(stocksData, niftyLevel);
  }, [stocksData, niftyLevel]);

  if (loading && isInitialMount.current) {
    return (
      <div className="nifty-contributors-loading">
        <div className="loading-spinner"></div>
        <p>Loading Nifty contributors...</p>
      </div>
    );
  }

  if (error && stocksData.length === 0) {
    return (
      <div className="nifty-contributors-error">
        <div className="error-icon">⚠️</div>
        <p>{error}</p>
        <button onClick={loadData} className="retry-btn">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="nifty-contributors">
      {/* Header */}
      <div className="contributors-header">
        <div className="contributors-title-section">
          <h2 className="contributors-title">
            <span className="contributors-icon">📊</span>
            Nifty Index Contributors
          </h2>
          <p className="contributors-subtitle">
            Who's lifting vs dragging the index - Sorted by Points, not %
          </p>
        </div>

        <div className="contributors-header-right">
          <MarketStrengthIndicator movers={processedData.movers} />
          <button onClick={loadData} disabled={loading} className="refresh-btn">
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Net Contribution Summary */}
      <div className="contribution-summary">
        <div className="summary-item summary-positive">
          <span className="summary-label">Total Positive</span>
          <span className="summary-value">+{processedData.totalPositive.toFixed(1)} pts</span>
        </div>
        <div className="summary-item summary-net">
          <span className="summary-label">Net Contribution</span>
          <span className={`summary-value ${processedData.netContribution >= 0 ? 'positive' : 'negative'}`}>
            {processedData.netContribution >= 0 ? '+' : ''}{processedData.netContribution.toFixed(1)} pts
          </span>
        </div>
        <div className="summary-item summary-negative">
          <span className="summary-label">Total Negative</span>
          <span className="summary-value">{processedData.totalNegative.toFixed(1)} pts</span>
        </div>
      </div>

      {/* Split Screen Layout */}
      <div className="contributors-grid">
        {/* LEFT: Index Movers (Green) */}
        <div className="contributors-column movers-column">
          <div className="column-header">
            <h3 className="column-title movers-title">
              <span>📈</span> Index Movers
            </h3>
            <span className="column-total positive">
              +{processedData.totalPositive.toFixed(1)} pts
            </span>
          </div>

          <div className="contributors-list">
            {processedData.movers.length === 0 ? (
              <div className="empty-contributors">
                <p>No positive contributors</p>
              </div>
            ) : (
              processedData.movers.map((stock, idx) => (
                <ContributorCard
                  key={stock.symbol}
                  stock={stock}
                  rank={idx + 1}
                  type="mover"
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Index Draggers (Red) */}
        <div className="contributors-column draggers-column">
          <div className="column-header">
            <h3 className="column-title draggers-title">
              <span>📉</span> Index Draggers
            </h3>
            <span className="column-total negative">
              {processedData.totalNegative.toFixed(1)} pts
            </span>
          </div>

          <div className="contributors-list">
            {processedData.draggers.length === 0 ? (
              <div className="empty-contributors">
                <p>No negative contributors</p>
              </div>
            ) : (
              processedData.draggers.map((stock, idx) => (
                <ContributorCard
                  key={stock.symbol}
                  stock={stock}
                  rank={idx + 1}
                  type="dragger"
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* OI Signal Legend */}
      <div className="oi-legend">
        <div className="legend-title">OI Signal Guide:</div>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-emoji">🟢</span>
            <span className="legend-label">Long Buildup</span>
            <span className="legend-desc">Fresh buying - trust the move</span>
          </div>
          <div className="legend-item">
            <span className="legend-emoji">🟡</span>
            <span className="legend-label">Short Covering</span>
            <span className="legend-desc">Weak move - be careful</span>
          </div>
          <div className="legend-item">
            <span className="legend-emoji">🔴</span>
            <span className="legend-label">Short Buildup</span>
            <span className="legend-desc">Fresh selling - trust the fall</span>
          </div>
          <div className="legend-item">
            <span className="legend-emoji">🟠</span>
            <span className="legend-label">Long Unwinding</span>
            <span className="legend-desc">Profit booking - just a dip</span>
          </div>
        </div>
      </div>

      {/* Last Update */}
      {lastUpdate && (
        <div className="contributors-footer">
          <span className="last-update">Last updated: {lastUpdateTime}</span>
        </div>
      )}
    </div>
  );
}
