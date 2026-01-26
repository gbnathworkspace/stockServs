import React, { useState, useEffect } from 'react';
import { authApi, fastAuthApi } from '../../lib/api.js';
import useAutoRefresh, { useRelativeTime } from '../../hooks/useAutoRefresh';

const API_BASE_URL = window.location.origin;

export default function Watchlist({ onNavigate }) {
  const [watchlist, setWatchlist] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [dataSource, setDataSource] = useState(''); // 'fyers' or 'nse'

  // Auto-refresh: Watchlist prices every 5s using Fyers API (with NSE fallback)
  const { lastUpdate } = useAutoRefresh('watchlist-prices', () => refreshPricesSilent(), 5000);
  const lastUpdateTime = useRelativeTime(lastUpdate);

  useEffect(() => {
    loadWatchlist();
    loadStocks();
  }, []);

  const loadWatchlist = async () => {
    // Load from localStorage for now (can be replaced with API)
    const saved = localStorage.getItem('watchlist');
    if (saved) {
      setWatchlist(JSON.parse(saved));
    }
  };

  const loadStocks = async () => {
    setLoading(true);
    try {
      // Use Fyers API for reliable stock data (fallback: NSE if Fyers not connected)
      const res = await authApi(`${API_BASE_URL}/fyers/market/all-stocks`);
      setStocks(res.stocks || []);

      // Fallback to NSE if Fyers fails or not connected
      if (!res.fyers_connected || (res.stocks && res.stocks.length === 0)) {
        console.log('[Watchlist] Fyers not connected, falling back to NSE');
        setDataSource('nse');
        const nseRes = await authApi(`${API_BASE_URL}/nse_data/all-stocks`);
        setStocks(nseRes.stocks || []);
      } else {
        setDataSource('fyers');
      }
    } catch (error) {
      console.error('Failed to load stocks:', error);
      // Try NSE as final fallback
      try {
        setDataSource('nse');
        const nseRes = await authApi(`${API_BASE_URL}/nse_data/all-stocks`);
        setStocks(nseRes.stocks || []);
      } catch (nseError) {
        console.error('NSE fallback also failed:', nseError);
      }
    } finally {
      setLoading(false);
    }
  };

  // Silent refresh with fast timeout (2s max, prevents cascade)
  // Uses Fyers quotes API for specific watchlist symbols (like Market Sandbox)
  const refreshPricesSilent = async () => {
    const saved = localStorage.getItem('watchlist');
    if (!saved) return;

    const savedWatchlist = JSON.parse(saved);
    if (savedWatchlist.length === 0) return;

    // Get only watchlist symbols for targeted refresh
    const symbols = savedWatchlist.map(w => w.symbol).filter(Boolean);
    if (symbols.length === 0) return;

    try {
      // Use Fyers quotes endpoint for live price refresh (max 50 symbols)
      const symbolsParam = symbols.slice(0, 50).join(',');
      const res = await fastAuthApi(`${API_BASE_URL}/fyers/market/quotes?symbols=${encodeURIComponent(symbolsParam)}`);

      if (res?.quotes && res.fyers_connected) {
        setDataSource('fyers');
        // Merge new prices with watchlist
        const updatedWatchlist = savedWatchlist.map(stock => {
          const quote = res.quotes[stock.symbol];
          if (quote) {
            return {
              ...stock,
              lastPrice: quote.lastPrice,
              pChange: quote.pChange,
              change: quote.change,
              dayHigh: quote.high,
              dayLow: quote.low,
              volume: quote.volume
            };
          }
          return stock;
        });
        setWatchlist(updatedWatchlist);

        // Also update stocks list for consistency
        const updatedStocks = stocks.map(s => {
          const quote = res.quotes[s.symbol];
          return quote ? { ...s, ...quote } : s;
        });
        setStocks(updatedStocks);
      } else {
        setDataSource('nse');
        // Fallback to NSE all-stocks if Fyers not available
        const nseRes = await fastAuthApi(`${API_BASE_URL}/nse_data/all-stocks`);
        if (nseRes?.stocks?.length > 0) {
          setStocks(nseRes.stocks);
          const updatedWatchlist = savedWatchlist.map(w => {
            const updated = nseRes.stocks.find(s => s.symbol === w.symbol);
            return updated || w;
          });
          setWatchlist(updatedWatchlist);
        }
      }
    } catch (err) {
      console.error('Failed to refresh watchlist prices', err);
    }
  };

  const addToWatchlist = (stock) => {
    const exists = watchlist.find(w => w.symbol === stock.symbol);
    if (!exists) {
      const newWatchlist = [...watchlist, stock];
      setWatchlist(newWatchlist);
      localStorage.setItem('watchlist', JSON.stringify(newWatchlist));
    }
    setShowAddModal(false);
    setSearchTerm('');
  };

  const removeFromWatchlist = (symbol) => {
    const newWatchlist = watchlist.filter(w => w.symbol !== symbol);
    setWatchlist(newWatchlist);
    localStorage.setItem('watchlist', JSON.stringify(newWatchlist));
  };

  const filteredStocks = stocks.filter(stock =>
    stock.symbol?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stock.identifier?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="watchlist-section">
      <div className="section-header">
        <div className="section-title">
          <span className="section-title-icon">⭐</span>
          <h2>Watchlist</h2>
          {dataSource && (
            <span style={{
              fontSize: '0.75rem',
              color: dataSource === 'fyers' ? '#00d09c' : '#ffa657',
              marginLeft: '0.5rem',
              padding: '0.125rem 0.5rem',
              borderRadius: '0.25rem',
              background: 'rgba(255,255,255,0.1)'
            }}>
              {dataSource === 'fyers' ? '🟢 Fyers Live' : '🟡 NSE Data'}
            </span>
          )}
        </div>
        <div className="section-actions">
          <button onClick={() => setShowAddModal(true)}>
            + Add Stock
          </button>
          <button onClick={loadStocks} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {watchlist.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⭐</div>
          <div className="empty-state-title">No Stocks in Watchlist</div>
          <div className="empty-state-text">
            Add stocks to your watchlist to track them easily.
          </div>
          <button className="primary-btn" onClick={() => setShowAddModal(true)}>
            Add Your First Stock
          </button>
        </div>
      ) : (
        <div className="watchlist-grid">
          {watchlist.map((stock) => {
            // Get latest price from stocks list
            const liveStock = stocks.find(s => s.symbol === stock.symbol);
            const lastPrice = liveStock?.lastPrice || stock.lastPrice || 0;
            const pChange = liveStock?.pChange || stock.pChange || 0;

            return (
              <div key={stock.symbol} className="watchlist-item">
                <div className="watchlist-info">
                  <span className="watchlist-symbol">{stock.symbol}</span>
                  <span className="watchlist-name">{stock.identifier || 'Equity'}</span>
                </div>
                <div className="watchlist-price-info">
                  <div className="watchlist-price">₹{Number(lastPrice).toLocaleString()}</div>
                  <div className={`watchlist-change ${pChange >= 0 ? 'positive' : 'negative'}`}>
                    {pChange >= 0 ? '+' : ''}{Number(pChange).toFixed(2)}%
                  </div>
                </div>
                <div className="watchlist-actions">
                  <button
                    className="watchlist-action-btn"
                    onClick={() => onNavigate('trading.trade')}
                    title="Trade"
                  >
                    💹
                  </button>
                  <button
                    className="watchlist-action-btn remove"
                    onClick={() => removeFromWatchlist(stock.symbol)}
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddModal && (
        <div className="stock-trade-modal" onClick={() => setShowAddModal(false)}>
          <div className="stock-trade-shell" onClick={e => e.stopPropagation()}>
            <div className="stock-trade-header">
              <div>
                <h3>Add to Watchlist</h3>
                <p className="muted">Search and add stocks to your watchlist</p>
              </div>
              <button className="icon-button" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <input
              type="text"
              className="search-input"
              placeholder="Search stocks by symbol or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />

            <div className="stock-list" style={{ maxHeight: '400px' }}>
              {loading ? (
                <div className="loading">Loading stocks...</div>
              ) : filteredStocks.length === 0 ? (
                <div className="loading">No stocks found</div>
              ) : (
                filteredStocks.slice(0, 20).map((stock) => {
                  const inWatchlist = watchlist.find(w => w.symbol === stock.symbol);
                  return (
                    <div
                      key={stock.symbol}
                      className={`stock-item ${inWatchlist ? 'selected' : ''}`}
                      onClick={() => !inWatchlist && addToWatchlist(stock)}
                    >
                      <div className="stock-info">
                        <span className="stock-symbol">{stock.symbol}</span>
                        <span className="stock-price">
                          {stock.identifier || 'Equity'}
                        </span>
                      </div>
                      <div className="stock-change">
                        {inWatchlist ? (
                          <span className="muted">Added ✓</span>
                        ) : stock.lastPrice ? (
                          <span className={stock.pChange >= 0 ? 'positive' : 'negative'}>
                            ₹{Number(stock.lastPrice).toLocaleString()}
                          </span>
                        ) : (
                          <span className="muted">-</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
