import React, { useState, useEffect, useRef } from 'react';
import { authApi, fastAuthApi } from '../../lib/api.js';
import useAutoRefresh, { useRelativeTime } from '../../hooks/useAutoRefresh';

const API_BASE_URL = window.location.origin;

/**
 * FiiDiiActivity - Shows FII/DII trading activity
 * Displays today's buy/sell/net values and historical trends
 */
export default function FiiDiiActivity() {
  const [todayData, setTodayData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isInitialMount = useRef(true);

  // Auto-refresh every 60 seconds (FII/DII data doesn't change frequently)
  const { lastUpdate } = useAutoRefresh('fii-dii', () => refreshDataSilent(), 60000);
  const lastUpdateTime = useRelativeTime(lastUpdate);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [todayRes, historyRes] = await Promise.all([
        authApi(`${API_BASE_URL}/nse_data/fii-dii-activity`),
        authApi(`${API_BASE_URL}/nse_data/fii-dii-history?limit=30`),
      ]);

      setTodayData(todayRes);
      setHistoryData(historyRes?.records || []);
    } catch (err) {
      console.error('Failed to load FII/DII data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      isInitialMount.current = false;
    }
  };

  const refreshDataSilent = async () => {
    const res = await fastAuthApi(`${API_BASE_URL}/nse_data/fii-dii-activity`);
    if (res) {
      setTodayData(res);
    }
  };

  // Format currency in Crores
  const formatCrores = (value) => {
    if (value === null || value === undefined) return '—';
    const crores = value / 100; // API returns in Cr * 100
    return `₹${Math.abs(crores).toFixed(2)} Cr`;
  };

  // Format net value with sign
  const formatNetValue = (value) => {
    if (value === null || value === undefined) return '—';
    const crores = value / 100;
    const sign = crores >= 0 ? '+' : '';
    return `${sign}₹${crores.toFixed(2)} Cr`;
  };

  // Get sentiment based on net value
  const getSentiment = (netValue) => {
    if (netValue === null || netValue === undefined) return 'neutral';
    return netValue >= 0 ? 'bullish' : 'bearish';
  };

  // Calculate totals for history
  const calculateHistoryTotals = () => {
    if (!historyData.length) return { fiiTotal: 0, diiTotal: 0, days: 0 };

    let fiiTotal = 0;
    let diiTotal = 0;
    let validDays = 0;

    historyData.forEach(record => {
      if (record.fii_net_value !== null) {
        fiiTotal += record.fii_net_value;
        validDays++;
      }
      if (record.dii_net_value !== null) {
        diiTotal += record.dii_net_value;
      }
    });

    return { fiiTotal, diiTotal, days: validDays };
  };

  const historyTotals = calculateHistoryTotals();

  if (loading && isInitialMount.current) {
    return (
      <div className="fii-dii-loading">
        <div className="loading-spinner"></div>
        <p>Loading FII/DII activity...</p>
      </div>
    );
  }

  if (error && !todayData) {
    return (
      <div className="fii-dii-error">
        <div className="error-icon">⚠️</div>
        <p>{error}</p>
        <button onClick={loadData} className="retry-btn">Retry</button>
      </div>
    );
  }

  const fii = todayData?.fii;
  const dii = todayData?.dii;
  const tradeDate = todayData?.date;

  return (
    <div className="fii-dii-activity">
      {/* Header */}
      <div className="fii-dii-header">
        <div className="fii-dii-title-section">
          <h2 className="fii-dii-title">
            <span className="fii-dii-icon">🏛️</span>
            FII / DII Activity
          </h2>
          <p className="fii-dii-subtitle">
            Foreign & Domestic Institutional Investor flows
            {tradeDate && <span className="trade-date"> • {tradeDate}</span>}
          </p>
        </div>
        <button onClick={loadData} disabled={loading} className="refresh-btn">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Today's Activity Cards */}
      <div className="fii-dii-cards">
        {/* FII Card */}
        <div className={`institutional-card fii-card ${getSentiment(fii?.netValue)}`}>
          <div className="card-header">
            <div className="card-title">
              <span className="card-icon">🌐</span>
              <span>FII (Foreign)</span>
            </div>
            <div className={`net-badge ${getSentiment(fii?.netValue)}`}>
              {fii?.netValue >= 0 ? 'Net Buyer' : 'Net Seller'}
            </div>
          </div>

          <div className="card-net-value">
            <span className={`net-amount ${getSentiment(fii?.netValue)}`}>
              {formatNetValue(fii?.netValue)}
            </span>
          </div>

          <div className="card-details">
            <div className="detail-row">
              <span className="detail-label">Buy Value</span>
              <span className="detail-value buy">{formatCrores(fii?.buyValue)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Sell Value</span>
              <span className="detail-value sell">{formatCrores(fii?.sellValue)}</span>
            </div>
          </div>
        </div>

        {/* DII Card */}
        <div className={`institutional-card dii-card ${getSentiment(dii?.netValue)}`}>
          <div className="card-header">
            <div className="card-title">
              <span className="card-icon">🏦</span>
              <span>DII (Domestic)</span>
            </div>
            <div className={`net-badge ${getSentiment(dii?.netValue)}`}>
              {dii?.netValue >= 0 ? 'Net Buyer' : 'Net Seller'}
            </div>
          </div>

          <div className="card-net-value">
            <span className={`net-amount ${getSentiment(dii?.netValue)}`}>
              {formatNetValue(dii?.netValue)}
            </span>
          </div>

          <div className="card-details">
            <div className="detail-row">
              <span className="detail-label">Buy Value</span>
              <span className="detail-value buy">{formatCrores(dii?.buyValue)}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Sell Value</span>
              <span className="detail-value sell">{formatCrores(dii?.sellValue)}</span>
            </div>
          </div>
        </div>

        {/* Combined Net Flow Card */}
        <div className={`institutional-card combined-card ${getSentiment((fii?.netValue || 0) + (dii?.netValue || 0))}`}>
          <div className="card-header">
            <div className="card-title">
              <span className="card-icon">📊</span>
              <span>Combined Flow</span>
            </div>
          </div>

          <div className="card-net-value">
            <span className={`net-amount ${getSentiment((fii?.netValue || 0) + (dii?.netValue || 0))}`}>
              {formatNetValue((fii?.netValue || 0) + (dii?.netValue || 0))}
            </span>
          </div>

          <div className="card-details">
            <div className="detail-row">
              <span className="detail-label">FII Net</span>
              <span className={`detail-value ${getSentiment(fii?.netValue)}`}>
                {formatNetValue(fii?.netValue)}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">DII Net</span>
              <span className={`detail-value ${getSentiment(dii?.netValue)}`}>
                {formatNetValue(dii?.netValue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Summary */}
      {historyData.length > 0 && (
        <div className="fii-dii-history">
          <h3 className="history-title">
            Last {historyTotals.days} Trading Days Summary
          </h3>

          <div className="history-summary">
            <div className={`summary-card ${getSentiment(historyTotals.fiiTotal)}`}>
              <div className="summary-label">FII Cumulative</div>
              <div className={`summary-value ${getSentiment(historyTotals.fiiTotal)}`}>
                {formatNetValue(historyTotals.fiiTotal)}
              </div>
            </div>
            <div className={`summary-card ${getSentiment(historyTotals.diiTotal)}`}>
              <div className="summary-label">DII Cumulative</div>
              <div className={`summary-value ${getSentiment(historyTotals.diiTotal)}`}>
                {formatNetValue(historyTotals.diiTotal)}
              </div>
            </div>
            <div className={`summary-card ${getSentiment(historyTotals.fiiTotal + historyTotals.diiTotal)}`}>
              <div className="summary-label">Total Institutional</div>
              <div className={`summary-value ${getSentiment(historyTotals.fiiTotal + historyTotals.diiTotal)}`}>
                {formatNetValue(historyTotals.fiiTotal + historyTotals.diiTotal)}
              </div>
            </div>
          </div>

          {/* History Table */}
          <div className="history-table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">FII Net</th>
                  <th className="text-right">DII Net</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {historyData.slice(0, 10).map((record, idx) => {
                  const total = (record.fii_net_value || 0) + (record.dii_net_value || 0);
                  return (
                    <tr key={record.trade_date || idx}>
                      <td className="date-cell">
                        {record.trade_date ? new Date(record.trade_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                        }) : '—'}
                      </td>
                      <td className={`text-right ${getSentiment(record.fii_net_value)}`}>
                        {formatNetValue(record.fii_net_value)}
                      </td>
                      <td className={`text-right ${getSentiment(record.dii_net_value)}`}>
                        {formatNetValue(record.dii_net_value)}
                      </td>
                      <td className={`text-right ${getSentiment(total)}`}>
                        {formatNetValue(total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Market Insight */}
      <div className="fii-dii-insight">
        <div className="insight-icon">💡</div>
        <div className="insight-content">
          <div className="insight-title">Market Insight</div>
          <div className="insight-text">
            {(() => {
              const fiiNet = fii?.netValue || 0;
              const diiNet = dii?.netValue || 0;
              const combined = fiiNet + diiNet;

              if (fiiNet > 0 && diiNet > 0) {
                return "Both FII & DII are buying - Strong bullish sentiment with institutional support.";
              } else if (fiiNet < 0 && diiNet < 0) {
                return "Both FII & DII are selling - Bearish sentiment, institutions are risk-off.";
              } else if (fiiNet < 0 && diiNet > 0) {
                return "FII selling, DII buying - DIIs absorbing FII selling pressure. Watch for support levels.";
              } else if (fiiNet > 0 && diiNet < 0) {
                return "FII buying, DII selling - Foreign interest increasing. DIIs may be booking profits.";
              } else {
                return "Mixed institutional activity. Monitor for clearer directional signals.";
              }
            })()}
          </div>
        </div>
      </div>

      {/* Last Update */}
      {lastUpdate && (
        <div className="fii-dii-footer">
          <span className="last-update">Last updated: {lastUpdateTime}</span>
        </div>
      )}
    </div>
  );
}
