import React, { useState, useEffect, useRef } from 'react';
import { authApi, fastAuthApi } from '../../lib/api.js';
import useAutoRefresh, { useRelativeTime } from '../../hooks/useAutoRefresh';

const API_BASE_URL = window.location.origin;

/**
 * FiiDiiActivity - Shows FII/DII trading activity
 * Displays today's buy/sell/net values and historical trends
 */

const FiiDiiChart = ({ data }) => {
  // Sort data chronologically (oldest to newest) for the chart
  const chartData = [...data].reverse();

  if (!chartData.length) return null;

  // Calculate scaling
  const values = chartData.flatMap(d => [d.fii_net_value, d.dii_net_value].filter(v => v !== null));
  const maxVal = Math.max(...values.map(v => Math.abs(v))) || 1000;
  const yDomain = maxVal * 1.1; // 10% padding
  const height = 220;
  const padding = { top: 20, bottom: 30, left: 10, right: 10 };
  const graphHeight = height - padding.top - padding.bottom;
  const zeroY = padding.top + graphHeight / 2;

  const getY = (val) => {
    // Normalization: -yDomain -> graphHeight, +yDomain -> 0
    // range: [-yDomain, +yDomain] -> [graphHeight, 0]
    // percent = (val - (-yDomain)) / (yDomain * 2) = (val + yDomain) / (2 * yDomain)
    // y = height - (percent * graphHeight)
    // Actually simpler: 
    // val=0 => zeroY
    // val=+yDomain => zeroY - (graphHeight/2)
    const offset = (val / yDomain) * (graphHeight / 2);
    return zeroY - offset;
  };

  const formatMoney = (val) => {
    return Math.abs(val / 100).toFixed(0) + 'Cr';
  };

  return (
    <div className="fii-dii-chart-container">
      <h3 className="history-title">Institutional Flow Trend</h3>
      <div className="chart-legend">
        <div className="legend-item">
          <span className="legend-color fii"></span> FII
        </div>
        <div className="legend-item">
          <span className="legend-color dii"></span> DII
        </div>
      </div>
      
      <div className="fii-dii-chart-scroll">

        <svg viewBox={`0 0 ${chartData.length * 60} ${height}`} preserveAspectRatio="xMidYMid meet" className="fii-dii-svg-content">
             <defs>
                <linearGradient id="gradGreen" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-green)" stopOpacity="0.8"/>
                    <stop offset="100%" stopColor="var(--accent-green)" stopOpacity="0.4"/>
                </linearGradient>
                <linearGradient id="gradRed" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="var(--accent-red)" stopOpacity="0.8"/>
                    <stop offset="100%" stopColor="var(--accent-red)" stopOpacity="0.4"/>
                </linearGradient>
            </defs>

            {/* Zero Line */}
            <line x1="0" y1={zeroY} x2="100%" y2={zeroY} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
            
            {/* Max/Min Guidelines */}
            <text x="5" y={padding.top + 10} fontSize="10" fill="var(--text-secondary)">+{formatMoney(yDomain)}</text>
            <text x="5" y={height - padding.bottom - 5} fontSize="10" fill="var(--text-secondary)">-{formatMoney(yDomain)}</text>

            {chartData.map((d, i) => {
                const xBase = i * 60;
                const xCenter = xBase + 30;
                const barWidth = 12;
                const gap = 4;
                
                const fiiVal = d.fii_net_value || 0;
                const diiVal = d.dii_net_value || 0;
                
                const fiiY = getY(fiiVal);
                const diiY = getY(diiVal);
                
                // Keep bars growing from zeroY
                const fiiHeight = Math.abs(fiiY - zeroY);
                const diiHeight = Math.abs(diiY - zeroY);
                
                // Correct Y Start: if positive, start at fiiY. If negative, start at zeroY.
                const fiiYStart = fiiVal >= 0 ? fiiY : zeroY;
                const diiYStart = diiVal >= 0 ? diiY : zeroY;

                const dateObj = new Date(d.trade_date);
                const dateStr = `${dateObj.getDate()} ${dateObj.toLocaleString('default', { month: 'short' }).slice(0,3)}`;

                return (
                    <g key={i}>
                         {/* Date Label */}
                         <text x={xCenter} y={height - 5} textAnchor="middle" fontSize="10" fill="var(--text-secondary)">
                            {dateStr}
                         </text>

                        {/* FII Bar */}
                        <title>{`${dateStr}\nFII: ${formatMoney(fiiVal*100)}\nDII: ${formatMoney(diiVal*100)}`}</title>
                        
                        <rect 
                            x={xCenter - barWidth - gap/2} 
                            y={fiiYStart} 
                            width={barWidth} 
                            height={fiiHeight || 1} 
                            fill={fiiVal >= 0 ? "url(#gradGreen)" : "url(#gradRed)"}
                            rx="2"
                        />

                        {/* DII Bar */}
                        <rect 
                            x={xCenter + gap/2} 
                            y={diiYStart} 
                            width={barWidth} 
                            height={diiHeight || 1} 
                            fill={diiVal >= 0 ? "var(--accent-green)" : "var(--accent-red)"}
                            opacity="0.5"
                            rx="2"
                            stroke={diiVal >= 0 ? "var(--accent-green)" : "var(--accent-red)"}
                            strokeWidth="0.5"
                        />
                    </g>
                );
            })}
        </svg>
      </div>
    </div>
  );
};

export default function FiiDiiActivity() {
  const [todayData, setTodayData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isInitialMount = useRef(true);
  const [page, setPage] = useState(0);
  const [totalRecords, setTotalRecords] = useState(0);
  const PAGE_SIZE = 10;

  // Auto-refresh every 60 seconds (FII/DII data doesn't change frequently)
  const { lastUpdate } = useAutoRefresh('fii-dii', () => refreshDataSilent(), 60000);
  const lastUpdateTime = useRelativeTime(lastUpdate);

  useEffect(() => {
    loadData();
  }, []);

  // Fetch chart data independently (30 days, only on mount)
  useEffect(() => {
    const loadChartData = async () => {
      const res = await fastAuthApi(`${API_BASE_URL}/nse_data/fii-dii-history?limit=30&offset=0`);
      if (res?.records) {
        setChartData(res.records);
      }
    };
    loadChartData();
  }, []);

  const loadData = async (pageNum) => {
    const currentPage = pageNum !== undefined ? pageNum : page;
    setLoading(true);
    setError(null);
    try {
      const offset = currentPage * PAGE_SIZE;

      // Fetch history independently so NSE failure doesn't block it
      const [todayResult, historyResult] = await Promise.allSettled([
        authApi(`${API_BASE_URL}/nse_data/fii-dii-activity`),
        authApi(`${API_BASE_URL}/nse_data/fii-dii-history?limit=${PAGE_SIZE}&offset=${offset}`),
      ]);

      if (todayResult.status === 'fulfilled') {
        setTodayData(todayResult.value);
      }

      if (historyResult.status === 'fulfilled') {
        const historyRes = historyResult.value;
        setHistoryData(historyRes?.records || []);
        setTotalRecords(historyRes?.total || 0);
      } else {
        console.error('Failed to load history:', historyResult.reason);
      }

      // Only show error if both failed
      if (todayResult.status === 'rejected' && historyResult.status === 'rejected') {
        setError(todayResult.reason?.message || 'Failed to load data');
      }
    } catch (err) {
      console.error('Failed to load FII/DII data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
      isInitialMount.current = false;
    }
  };

  const handlePageChange = (newPage) => {
    setPage(newPage);
    loadData(newPage);
  };

  const totalPages = Math.ceil(totalRecords / PAGE_SIZE) || 1;

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
            History ({totalRecords} Trading Days)
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
                {historyData.map((record, idx) => {
                  const total = (record.fii_net_value || 0) + (record.dii_net_value || 0);
                  return (
                    <tr key={record.trade_date || idx}>
                      <td className="date-cell">
                        {record.trade_date ? new Date(record.trade_date).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
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

          {totalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(page - 1)}
                disabled={page === 0}
              >
                &lt;
              </button>
              {Array.from({ length: totalPages }, (_, i) => {
                // Show: first, last, current, and neighbors within 2 of current
                const show = i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 2;
                const showEllipsis = !show && (i === 1 || i === totalPages - 2);
                if (showEllipsis) return <span key={i} className="pagination-ellipsis">...</span>;
                if (!show) return null;
                return (
                  <button
                    key={i}
                    className={`pagination-num ${i === page ? 'active' : ''}`}
                    onClick={() => handlePageChange(i)}
                  >
                    {i + 1}
                  </button>
                );
              })}
              <button
                className="pagination-btn"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages - 1}
              >
                &gt;
              </button>
            </div>
          )}

          {/* Graph Section */}
          <FiiDiiChart data={chartData} />
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
