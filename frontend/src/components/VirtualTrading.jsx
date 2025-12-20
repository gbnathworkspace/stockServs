import React, { useState, useEffect } from 'react';
import { authApi } from '../lib/api.js';

const API_BASE_URL = window.location.origin;

const VirtualTrading = () => {
  const [activeTab, setActiveTab] = useState('stocks');
  const [stocks, setStocks] = useState([]);
  const [filteredStocks, setFilteredStocks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStock, setSelectedStock] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [loading, setLoading] = useState({ stocks: false, portfolio: false, trade: false });
  const [tradeForm, setTradeForm] = useState({ quantity: 1, price: '' });
  const [toast, setToast] = useState({ message: '', type: '', show: false });

  // Show toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast({ message: '', type: '', show: false }), 3000);
  };

  // Fetch all stocks (with fallback to top gainers + losers)
  const fetchStocks = async () => {
    setLoading((l) => ({ ...l, stocks: true }));
    try {
      // Try all-stocks first
      const res = await authApi(`${API_BASE_URL}/nse_data/all-stocks`);
      const stockList = res.stocks || [];
      if (stockList.length > 0) {
        setStocks(stockList);
        setFilteredStocks(stockList);
        return;
      }
    } catch (err) {
      console.log('all-stocks failed, trying fallback...', err);
    }

    // Fallback: combine top gainers and top losers
    try {
      const [gainersRes, losersRes] = await Promise.all([
        authApi(`${API_BASE_URL}/nse_data/top-gainers`),
        authApi(`${API_BASE_URL}/nse_data/top-losers`),
      ]);
      const gainers = gainersRes.top_gainers || [];
      const losers = losersRes.top_losers || [];
      
      // Combine and deduplicate
      const combined = [...gainers, ...losers];
      const seen = new Set();
      const unique = combined.filter((s) => {
        if (seen.has(s.symbol)) return false;
        seen.add(s.symbol);
        return true;
      });
      
      // Sort alphabetically
      unique.sort((a, b) => a.symbol.localeCompare(b.symbol));
      
      setStocks(unique);
      setFilteredStocks(unique);
      showToast('Loaded stocks from market movers', 'info');
    } catch (err) {
      console.error('Failed to load stocks', err);
      showToast('Failed to load stocks', 'error');
    } finally {
      setLoading((l) => ({ ...l, stocks: false }));
    }
  };


  // Fetch portfolio
  const fetchPortfolio = async () => {
    setLoading((l) => ({ ...l, portfolio: true }));
    try {
      const res = await authApi(`${API_BASE_URL}/portfolio`);
      setPortfolio(res.holdings || []);
    } catch (err) {
      console.error('Failed to load portfolio', err);
      showToast('Failed to load portfolio', 'error');
    } finally {
      setLoading((l) => ({ ...l, portfolio: false }));
    }
  };

  // Filter stocks by search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStocks(stocks);
    } else {
      const query = searchQuery.toUpperCase();
      setFilteredStocks(stocks.filter((s) => s.symbol.includes(query)));
    }
  }, [searchQuery, stocks]);

  // Load stocks on mount
  useEffect(() => {
    fetchStocks();
    fetchPortfolio();
  }, []);

  // Select a stock
  const handleSelectStock = (stock) => {
    setSelectedStock(stock);
    setTradeForm({ quantity: 1, price: stock.lastPrice?.toFixed(2) || '' });
  };

  // Execute trade
  const executeTrade = async (side) => {
    if (!selectedStock) return;
    if (!tradeForm.quantity || tradeForm.quantity <= 0) {
      showToast('Enter a valid quantity', 'error');
      return;
    }
    if (!tradeForm.price || parseFloat(tradeForm.price) <= 0) {
      showToast('Enter a valid price', 'error');
      return;
    }

    setLoading((l) => ({ ...l, trade: true }));
    try {
      const payload = {
        symbol: selectedStock.symbol,
        quantity: parseInt(tradeForm.quantity),
        price: parseFloat(tradeForm.price),
        side: side,
      };
      const res = await authApi(`${API_BASE_URL}/portfolio/trade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setPortfolio(res.holdings || []);
      showToast(`${side} order executed for ${selectedStock.symbol}`, 'success');
    } catch (err) {
      console.error('Trade failed', err);
      showToast(err.message || 'Trade failed', 'error');
    } finally {
      setLoading((l) => ({ ...l, trade: false }));
    }
  };

  // Calculate total P&L
  const totalPnL = portfolio.reduce((sum, h) => sum + (h.pnl || 0), 0);
  const totalValue = portfolio.reduce((sum, h) => sum + (h.ltp || h.average_price) * h.quantity, 0);

  return (
    <div className="virtual-trading">
      {/* Toast notification */}
      {toast.show && (
        <div className={`virtual-toast ${toast.type}`}>{toast.message}</div>
      )}

      {/* Tab switcher */}
      <div className="virtual-tabs">
        <button
          className={`virtual-tab ${activeTab === 'stocks' ? 'active' : ''}`}
          onClick={() => setActiveTab('stocks')}
        >
          Stocks & Trading
        </button>
        <button
          className={`virtual-tab ${activeTab === 'portfolio' ? 'active' : ''}`}
          onClick={() => { setActiveTab('portfolio'); fetchPortfolio(); }}
        >
          Portfolio
        </button>
      </div>

      {/* Stocks & Trading Tab */}
      {activeTab === 'stocks' && (
        <div className="virtual-grid">
          {/* Left panel - Stock list */}
          <div className="virtual-left">
            <div className="virtual-left-header">
              <div>
                <p className="eyebrow">NSE Stocks</p>
                <h2>Pick a stock to trade</h2>
                <p className="muted">Search and select a stock to simulate trades</p>
              </div>
              <button className="ghost-btn" onClick={fetchStocks} disabled={loading.stocks}>
                {loading.stocks ? 'Loading...' : 'Refresh'}
              </button>
            </div>

            <div className="search-row">
              <input
                type="text"
                placeholder="Search symbol..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="stock-list">
              {loading.stocks ? (
                <div className="loading">Loading stocks...</div>
              ) : filteredStocks.length === 0 ? (
                <div className="loading">No stocks found</div>
              ) : (
                filteredStocks.map((stock) => (
                  <div
                    key={stock.symbol}
                    className={`stock-item ${selectedStock?.symbol === stock.symbol ? 'selected' : ''}`}
                    onClick={() => handleSelectStock(stock)}
                  >
                    <div className="stock-info">
                      <span className="stock-symbol">{stock.symbol}</span>
                      <span className="stock-price">₹{Number(stock.lastPrice || 0).toFixed(2)}</span>
                    </div>
                    <span className={`stock-change ${stock.pChange >= 0 ? 'positive' : 'negative'}`}>
                      {stock.pChange >= 0 ? '+' : ''}{Number(stock.pChange || 0).toFixed(2)}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right panel - Trade panel */}
          <div className="virtual-right">
            {!selectedStock ? (
              <div className="trade-panel empty">
                <h3>Select a Stock</h3>
                <p className="muted">Choose a stock from the list to view details and trade</p>
              </div>
            ) : (
              <div className="trade-panel">
                <div className="trade-header">
                  <h3>{selectedStock.symbol}</h3>
                  <span className="trade-badge">Virtual Trading</span>
                </div>

                <div className="trade-price-section">
                  <div className="current-price">
                    <span className="label">Current Price</span>
                    <span className="price">₹{Number(selectedStock.lastPrice || 0).toFixed(2)}</span>
                  </div>
                  <div className={`price-change ${selectedStock.pChange >= 0 ? 'positive' : 'negative'}`}>
                    {selectedStock.pChange >= 0 ? '+' : ''}{Number(selectedStock.pChange || 0).toFixed(2)}%
                  </div>
                </div>

                <div className="trade-stats">
                  <div className="stat">
                    <span className="label">High</span>
                    <span className="value">₹{Number(selectedStock.dayHigh || selectedStock.lastPrice || 0).toFixed(2)}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Low</span>
                    <span className="value">₹{Number(selectedStock.dayLow || selectedStock.lastPrice || 0).toFixed(2)}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Open</span>
                    <span className="value">₹{Number(selectedStock.open || selectedStock.lastPrice || 0).toFixed(2)}</span>
                  </div>
                </div>

                <div className="trade-form">
                  <div className="form-row">
                    <label>Quantity</label>
                    <input
                      type="number"
                      min="1"
                      value={tradeForm.quantity}
                      onChange={(e) => setTradeForm({ ...tradeForm, quantity: e.target.value })}
                    />
                  </div>
                  <div className="form-row">
                    <label>Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={tradeForm.price}
                      onChange={(e) => setTradeForm({ ...tradeForm, price: e.target.value })}
                    />
                  </div>
                  <div className="form-row total">
                    <span>Total Value</span>
                    <span className="total-value">
                      ₹{((tradeForm.quantity || 0) * (parseFloat(tradeForm.price) || 0)).toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="trade-buttons">
                  <button
                    className="buy-btn"
                    onClick={() => executeTrade('BUY')}
                    disabled={loading.trade}
                  >
                    {loading.trade ? 'Processing...' : 'BUY'}
                  </button>
                  <button
                    className="sell-btn"
                    onClick={() => executeTrade('SELL')}
                    disabled={loading.trade}
                  >
                    {loading.trade ? 'Processing...' : 'SELL'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Portfolio Tab */}
      {activeTab === 'portfolio' && (
        <div className="portfolio-section">
          <div className="portfolio-header">
            <div>
              <h2>Your Virtual Portfolio</h2>
              <p className="muted">Track your simulated investments and P&L</p>
            </div>
            <button className="ghost-btn" onClick={fetchPortfolio} disabled={loading.portfolio}>
              {loading.portfolio ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          <div className="portfolio-summary">
            <div className="summary-card">
              <span className="label">Total Value</span>
              <span className="value">₹{totalValue.toFixed(2)}</span>
            </div>
            <div className={`summary-card ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
              <span className="label">Total P&L</span>
              <span className="value">
                {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toFixed(2)}
              </span>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Avg Price</th>
                  <th className="text-right">LTP</th>
                  <th className="text-right">P&L</th>
                </tr>
              </thead>
              <tbody>
                {loading.portfolio ? (
                  <tr>
                    <td colSpan="5" className="loading">Loading portfolio...</td>
                  </tr>
                ) : portfolio.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="loading">No holdings yet. Start trading!</td>
                  </tr>
                ) : (
                  portfolio.map((h) => {
                    const pnlClass = h.pnl > 0 ? 'positive' : h.pnl < 0 ? 'negative' : '';
                    return (
                      <tr key={h.symbol}>
                        <td>{h.symbol}</td>
                        <td className="text-right">{h.quantity}</td>
                        <td className="text-right">₹{Number(h.average_price).toFixed(2)}</td>
                        <td className="text-right">
                          {h.ltp != null ? `₹${Number(h.ltp).toFixed(2)}` : '--'}
                        </td>
                        <td className={`text-right ${pnlClass}`}>
                          {h.pnl != null ? `${h.pnl >= 0 ? '+' : ''}₹${Number(h.pnl).toFixed(2)}` : '--'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualTrading;
