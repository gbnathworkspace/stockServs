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

  // Auto-refresh: Watchlist prices every 5s (prevents DB pool exhaustion)
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
      const res = await authApi(`${API_BASE_URL}/nse_data/all-stocks`);
      setStocks(res.stocks || []);
    } catch (error) {
      console.error('Failed to load stocks:', error);
    } finally {
      setLoading(false);
    }
  };

  // Silent refresh with fast timeout (2s max, prevents cascade)
  const refreshPricesSilent = async () => {
    const res = await fastAuthApi(`${API_BASE_URL}/nse_data/all-stocks`);
    if (res?.stocks?.length > 0) {
      setStocks(res.stocks);
      // Update watchlist with latest prices
      const saved = localStorage.getItem('watchlist');
      if (saved) {
        const savedWatchlist = JSON.parse(saved);
        const updatedWatchlist = savedWatchlist.map(w => {
          const updated = res.stocks.find(s => s.symbol === w.symbol);
          return updated || w;
        });
        setWatchlist(updatedWatchlist);
      }
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
                  <div className="watchlist-price">
                    {lastPrice > 0 ? `₹${Number(lastPrice).toLocaleString()}` : 'N/A'}
                  </div>
                  <div className={`watchlist-change ${pChange >= 0 ? 'positive' : 'negative'}`}>
                    {lastPrice > 0 ? `${pChange >= 0 ? '+' : ''}${Number(pChange).toFixed(2)}%` : '-'}
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
