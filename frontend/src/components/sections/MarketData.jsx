import React, { useState, useEffect } from 'react';
import { authApi } from '../../lib/api.js';

const API_BASE_URL = window.location.origin;

export default function MarketData({ subSection }) {
  const [data, setData] = useState([]);
  const [weeklyData, setWeeklyData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [subSection]);

  const loadData = async () => {
    setLoading(true);
    try {
      let endpoint = '';
      switch (subSection) {
        case 'gainers':
          endpoint = '/nse_data/top-gainers';
          break;
        case 'losers':
          endpoint = '/nse_data/top-losers';
          break;
        case 'bulk':
          endpoint = '/nse_data/bulk-deals';
          break;
        case 'weekly':
          endpoint = '/nse_data/weekly-gainers?days=5';
          break;
        default:
          endpoint = '/nse_data/top-gainers';
      }

      const res = await authApi(`${API_BASE_URL}${endpoint}`);

      if (subSection === 'weekly') {
        setWeeklyData(res);
      } else if (subSection === 'bulk') {
        setData(res.bulk_deals || []);
      } else {
        setData(res.top_gainers || res.top_losers || []);
      }
    } catch (error) {
      console.error('Failed to load market data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (subSection) {
      case 'gainers': return 'Top Gainers';
      case 'losers': return 'Top Losers';
      case 'bulk': return 'Bulk Deals';
      case 'weekly': return 'Weekly Movers';
      default: return 'Market Data';
    }
  };

  const getIcon = () => {
    switch (subSection) {
      case 'gainers': return '📈';
      case 'losers': return '📉';
      case 'bulk': return '📊';
      case 'weekly': return '📅';
      default: return '📊';
    }
  };

  if (subSection === 'weekly') {
    return (
      <div className="market-section">
        <div className="section-header">
          <div className="section-title">
            <span className="section-title-icon">{getIcon()}</span>
            <h2>{getTitle()}</h2>
          </div>
          <button onClick={loadData} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading weekly data...</div>
        ) : !weeklyData?.weeklyData?.length ? (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-title">No Weekly Data</div>
            <div className="empty-state-text">Weekly movers data is not available.</div>
          </div>
        ) : (
          <div className="weekly-container">
            {weeklyData.weeklyData.map((day) => (
              <div key={day.dayName + day.date} className="weekly-column">
                <div className="weekly-header">
                  <div>{day.dayName}</div>
                  <span className="muted">{day.date}</span>
                </div>
                <div className="weekly-block">
                  <div className="section-label positive">Top Gainers</div>
                  {(day.gainers || []).slice(0, 5).map((g) => (
                    <div className="mini-row" key={`g-${g.symbol}`}>
                      <span>{g.symbol}</span>
                      <span className="text-right positive">{g.pChange?.toFixed(2)}%</span>
                    </div>
                  ))}
                  <div className="section-label negative">Top Losers</div>
                  {(day.losers || []).slice(0, 5).map((l) => (
                    <div className="mini-row" key={`l-${l.symbol}`}>
                      <span>{l.symbol}</span>
                      <span className="text-right negative">{l.pChange?.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (subSection === 'bulk') {
    return (
      <div className="market-section">
        <div className="section-header">
          <div className="section-title">
            <span className="section-title-icon">{getIcon()}</span>
            <h2>{getTitle()}</h2>
          </div>
          <button onClick={loadData} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {loading ? (
          <div className="loading">Loading bulk deals...</div>
        ) : data.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No Bulk Deals</div>
            <div className="empty-state-text">Bulk deals data is not available.</div>
          </div>
        ) : (
          <div className="orders-table-container">
            <table className="orders-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Client</th>
                  <th className="text-right">Quantity</th>
                  <th className="text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {data.map((item, idx) => (
                  <tr key={`${item.symbol}-${idx}`}>
                    <td className="order-symbol">{item.symbol || item.BD_SYMBOL || 'N/A'}</td>
                    <td>{item.clientName || item.client_name || item.BD_CLIENT_NAME || 'N/A'}</td>
                    <td className="text-right">
                      {(item.quantity || item.quantityTraded || item.BD_QTY_TRD || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      ₹{Number(item.tradePrice || item.price || item.BD_TP_WATP || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // Gainers/Losers view
  const isGainers = subSection === 'gainers';

  return (
    <div className="market-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">{getIcon()}</span>
          <h2>{getTitle()}</h2>
        </div>
        <button onClick={loadData} disabled={loading}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="loading">Loading market data...</div>
      ) : data.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">{getIcon()}</div>
          <div className="empty-state-title">No Data Available</div>
          <div className="empty-state-text">Market data is not available at this time.</div>
        </div>
      ) : (
        <div className="market-grid">
          {data.map((stock, idx) => (
            <div key={stock.symbol || idx} className="market-card-item">
              <div className="market-card-header">
                <span className="market-symbol">{stock.symbol}</span>
                <span className={`market-change-badge ${isGainers ? 'positive' : 'negative'}`}>
                  {isGainers ? '+' : ''}{Number(stock.pChange || 0).toFixed(2)}%
                </span>
              </div>
              <div className="market-card-body">
                <div className="market-price-main">
                  ₹{Number(stock.lastPrice || 0).toLocaleString()}
                </div>
                <div className="market-stats">
                  <div className="market-stat">
                    <span className="market-stat-label">Open</span>
                    <span>₹{Number(stock.open || 0).toLocaleString()}</span>
                  </div>
                  <div className="market-stat">
                    <span className="market-stat-label">High</span>
                    <span>₹{Number(stock.dayHigh || 0).toLocaleString()}</span>
                  </div>
                  <div className="market-stat">
                    <span className="market-stat-label">Low</span>
                    <span>₹{Number(stock.dayLow || 0).toLocaleString()}</span>
                  </div>
                  <div className="market-stat">
                    <span className="market-stat-label">Prev Close</span>
                    <span>₹{Number(stock.previousClose || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
