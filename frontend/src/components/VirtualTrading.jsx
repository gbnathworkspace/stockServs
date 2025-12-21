import React, { useState, useEffect, useRef } from 'react';
import { authApi } from '../lib/api.js';

const API_BASE_URL = window.location.origin;
const CHART_RANGES = [
  { label: '5m', interval: '5m', period: '5d' },
  { label: '15m', interval: '15m', period: '1mo' },
  { label: '1D', interval: '1d', period: '6mo' },
];

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
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [chartRange, setChartRange] = useState({ interval: '5m', period: '5d' });
  const [chartStatus, setChartStatus] = useState({ loading: false, error: '' });
  const candleContainerRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const chartRefs = useRef({
    chart: null,
    rsiChart: null,
    candleSeries: null,
    volumeSeries: null,
    smaSeries: null,
    emaSeries: null,
    rsiSeries: null,
  });

  // Show toast notification
  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast({ message: '', type: '', show: false }), 3000);
  };

  const openChart = () => {
    if (!selectedStock) return;
    setChartStatus({ loading: false, error: '' });
    setIsChartOpen(true);
  };

  const closeChart = () => {
    setIsChartOpen(false);
    clearCharts();
  };

  const clearCharts = () => {
    if (chartRefs.current.chart) {
      chartRefs.current.chart.remove();
    }
    if (chartRefs.current.rsiChart) {
      chartRefs.current.rsiChart.remove();
    }
    chartRefs.current = {
      chart: null,
      rsiChart: null,
      candleSeries: null,
      volumeSeries: null,
      smaSeries: null,
      emaSeries: null,
      rsiSeries: null,
    };
  };

  const updateChartStatus = (loadingState, errorMessage = '') => {
    setChartStatus({ loading: loadingState, error: errorMessage });
  };

  const resizeCharts = () => {
    const chart = chartRefs.current.chart;
    const rsiChart = chartRefs.current.rsiChart;
    const candleContainer = candleContainerRef.current;
    const rsiContainer = rsiContainerRef.current;
    if (chart && candleContainer) {
      chart.applyOptions({
        width: candleContainer.clientWidth,
        height: candleContainer.clientHeight,
      });
    }
    if (rsiChart && rsiContainer) {
      rsiChart.applyOptions({
        width: rsiContainer.clientWidth,
        height: rsiContainer.clientHeight,
      });
    }
  };

  const ensureCharts = () => {
    if (chartRefs.current.chart && chartRefs.current.rsiChart) {
      resizeCharts();
      return true;
    }
    const lib = window.LightweightCharts;
    if (!lib) {
      updateChartStatus(false, 'Chart library failed to load');
      return false;
    }
    const candleContainer = candleContainerRef.current;
    const rsiContainer = rsiContainerRef.current;
    if (!candleContainer || !rsiContainer) return false;

    chartRefs.current.chart = lib.createChart(candleContainer, {
      layout: {
        background: { color: '#181b21' },
        textColor: '#e1e3e6',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#1f242d' },
        horzLines: { color: '#1f242d' },
      },
      rightPriceScale: { borderColor: '#2d333b' },
      timeScale: { timeVisible: true },
      crosshair: { mode: lib.CrosshairMode.Normal },
    });

    chartRefs.current.candleSeries = chartRefs.current.chart.addCandlestickSeries({
      upColor: '#00d09c',
      downColor: '#ff4d4d',
      wickUpColor: '#00d09c',
      wickDownColor: '#ff4d4d',
      borderVisible: false,
    });

    chartRefs.current.volumeSeries = chartRefs.current.chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRefs.current.smaSeries = chartRefs.current.chart.addLineSeries({
      color: '#f5c542',
      lineWidth: 2,
      priceLineVisible: false,
    });

    chartRefs.current.emaSeries = chartRefs.current.chart.addLineSeries({
      color: '#4f9cf7',
      lineWidth: 2,
      priceLineVisible: false,
    });

    chartRefs.current.rsiChart = lib.createChart(rsiContainer, {
      layout: {
        background: { color: '#181b21' },
        textColor: '#e1e3e6',
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      grid: {
        vertLines: { color: '#1f242d' },
        horzLines: { color: '#1f242d' },
      },
      rightPriceScale: { borderColor: '#2d333b' },
      timeScale: { timeVisible: true },
      crosshair: { mode: lib.CrosshairMode.Normal },
    });

    chartRefs.current.rsiSeries = chartRefs.current.rsiChart.addLineSeries({
      color: '#9b74ff',
      lineWidth: 2,
      priceLineVisible: false,
    });

    chartRefs.current.rsiChart.priceScale('right').applyOptions({ minValue: 0, maxValue: 100 });
    chartRefs.current.rsiSeries.createPriceLine({
      price: 70,
      color: '#4f9cf7',
      lineWidth: 1,
      lineStyle: lib.LineStyle.Dashed,
    });
    chartRefs.current.rsiSeries.createPriceLine({
      price: 30,
      color: '#ff4d4d',
      lineWidth: 1,
      lineStyle: lib.LineStyle.Dashed,
    });

    chartRefs.current.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range && chartRefs.current.rsiChart) {
        chartRefs.current.rsiChart.timeScale().setVisibleLogicalRange(range);
      }
    });

    resizeCharts();
    return true;
  };

  const applyChartData = (data) => {
    if (!data) return;
    const { candleSeries, volumeSeries, smaSeries, emaSeries, rsiSeries, chart, rsiChart } = chartRefs.current;
    if (candleSeries) {
      candleSeries.setData(data.candles || []);
    }
    if (volumeSeries) {
      volumeSeries.setData(data.volume || []);
    }
    if (smaSeries) {
      smaSeries.setData(data.indicators?.sma20 || []);
    }
    if (emaSeries) {
      emaSeries.setData(data.indicators?.ema20 || []);
    }
    if (rsiSeries) {
      rsiSeries.setData(data.indicators?.rsi14 || []);
    }
    if (chart) {
      chart.timeScale().fitContent();
    }
    if (rsiChart) {
      rsiChart.timeScale().fitContent();
    }
  };

  const loadChartData = async (symbol, interval, period) => {
    if (!symbol) return;
    updateChartStatus(true, '');
    try {
      const url = `${API_BASE_URL}/market-data/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}&period=${period}`;
      const data = await authApi(url);
      applyChartData(data);
      updateChartStatus(false, '');
    } catch (err) {
      updateChartStatus(false, err.message || 'Failed to load chart');
    }
  };

  // Fetch all stocks (with fallback to top gainers + losers)
  const fetchStocks = async () => {
    setLoading((l) => ({ ...l, stocks: true }));
    try {
      const res = await authApi(`${API_BASE_URL}/nse_data/all-stocks`);
      const stockList = res.stocks || [];
      if (stockList.length > 0) {
        setStocks(stockList);
        setFilteredStocks(stockList);
        setLoading((l) => ({ ...l, stocks: false }));
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
      
      const combined = [...gainers, ...losers];
      const seen = new Set();
      const unique = combined.filter((s) => {
        if (seen.has(s.symbol)) return false;
        seen.add(s.symbol);
        return true;
      });
      
      unique.sort((a, b) => a.symbol.localeCompare(b.symbol));
      
      setStocks(unique);
      setFilteredStocks(unique);
      if (unique.length > 0) {
        showToast('Loaded stocks from market movers', 'info');
      }
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

  useEffect(() => {
    if (!isChartOpen || !selectedStock) return;
    const ready = ensureCharts();
    if (!ready) return;
    loadChartData(selectedStock.symbol, chartRange.interval, chartRange.period);
  }, [isChartOpen, selectedStock, chartRange]);

  useEffect(() => {
    if (!isChartOpen) {
      document.body.style.overflow = '';
      return;
    }
    document.body.style.overflow = 'hidden';
    const handleResize = () => resizeCharts();
    window.addEventListener('resize', handleResize);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('resize', handleResize);
    };
  }, [isChartOpen]);

  useEffect(() => {
    return () => {
      clearCharts();
    };
  }, []);

  // Select a stock - opens the trade modal
  const handleSelectStock = (stock) => {
    setSelectedStock(stock);
    setTradeForm({ quantity: 1, price: stock.lastPrice?.toFixed(2) || '' });
  };

  // Select a portfolio holding - converts to stock format and opens trade modal
  const handleSelectHolding = (holding) => {
    const stockFromHolding = {
      symbol: holding.symbol,
      lastPrice: holding.ltp || holding.average_price,
      pChange: holding.pnl_percent || 0,
      dayHigh: holding.ltp || holding.average_price,
      dayLow: holding.ltp || holding.average_price,
      open: holding.average_price,
      quantity: holding.quantity,
      avgPrice: holding.average_price,
      pnl: holding.pnl,
    };
    setSelectedStock(stockFromHolding);
    setTradeForm({ quantity: holding.quantity, price: stockFromHolding.lastPrice?.toFixed(2) || '' });
  };

  // Close trade modal
  const closeTradeModal = () => {
    setSelectedStock(null);
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
      showToast(`${side} ${tradeForm.quantity} ${selectedStock.symbol} @ ₹${parseFloat(tradeForm.price).toFixed(2)}`, 'success');
      // Close modal after successful trade
      setTimeout(() => closeTradeModal(), 1200);
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
        <div className="virtual-stocks-container">
          {/* Header */}
          <div className="virtual-stocks-header">
            <div>
              <p className="eyebrow">NSE STOCKS</p>
              <h2>Pick a stock to trade</h2>
              <p className="muted">Search and select a stock to simulate trades</p>
            </div>
            <button className="ghost-btn" onClick={fetchStocks} disabled={loading.stocks}>
              {loading.stocks ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {/* Search */}
          <div className="search-row">
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Stock Grid */}
          <div className="stock-grid">
            {loading.stocks ? (
              <div className="loading">Loading stocks...</div>
            ) : filteredStocks.length === 0 ? (
              <div className="loading">No stocks found</div>
            ) : (
              filteredStocks.map((stock) => (
                <div
                  key={stock.symbol}
                  className="stock-item"
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
      )}

      {/* Stock Trade Modal */}
      {selectedStock && (activeTab === 'stocks' || activeTab === 'portfolio') && !isChartOpen && (
        <div className="stock-trade-modal" onClick={closeTradeModal}>
          <div className="stock-trade-shell" onClick={(e) => e.stopPropagation()}>
            <div className="stock-trade-header">
              <div>
                <h3>{selectedStock.symbol}</h3>
                <span className="trade-badge">VIRTUAL TRADING</span>
              </div>
              <button className="icon-button" onClick={closeTradeModal}>×</button>
            </div>

            <div className="stock-trade-content">
              {/* Price Row */}
              <div className="stock-trade-price-row">
                <div className="stock-trade-price-block">
                  <span className="stock-trade-label">Current Price</span>
                  <span className="stock-trade-price">₹{Number(selectedStock.lastPrice || 0).toFixed(2)}</span>
                </div>
                <div className={`chip large ${selectedStock.pChange >= 0 ? 'positive' : 'negative'}`}>
                  {selectedStock.pChange >= 0 ? '+' : ''}{Number(selectedStock.pChange || 0).toFixed(2)}%
                </div>
              </div>

              {/* Stats */}
              <div className="stock-trade-stats">
                <div className="stock-trade-stat">
                  <span className="stock-trade-stat-label">High</span>
                  <span className="stock-trade-stat-value">₹{Number(selectedStock.dayHigh || selectedStock.lastPrice || 0).toFixed(2)}</span>
                </div>
                <div className="stock-trade-stat">
                  <span className="stock-trade-stat-label">Low</span>
                  <span className="stock-trade-stat-value">₹{Number(selectedStock.dayLow || selectedStock.lastPrice || 0).toFixed(2)}</span>
                </div>
                <div className="stock-trade-stat">
                  <span className="stock-trade-stat-label">Open</span>
                  <span className="stock-trade-stat-value">₹{Number(selectedStock.open || selectedStock.lastPrice || 0).toFixed(2)}</span>
                </div>
              </div>

              {/* Trade Form */}
              <div className="stock-trade-input-row">
                <div className="stock-trade-input-group">
                  <label>Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={tradeForm.quantity}
                    onChange={(e) => setTradeForm({ ...tradeForm, quantity: e.target.value })}
                  />
                </div>
                <div className="stock-trade-input-group">
                  <label>Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={tradeForm.price}
                    onChange={(e) => setTradeForm({ ...tradeForm, price: e.target.value })}
                  />
                </div>
              </div>

              {/* Total */}
              <div className="stock-trade-total">
                <span>Total Value</span>
                <span className={`stock-trade-total-value ${selectedStock.pChange >= 0 ? 'positive' : 'negative'}`}>
                  ₹{((tradeForm.quantity || 0) * (parseFloat(tradeForm.price) || 0)).toFixed(2)}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="stock-trade-actions">
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
                <button
                  className="chart-btn"
                  onClick={openChart}
                  disabled={chartStatus.loading}
                >
                  View chart
                </button>
              </div>
            </div>
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
                      <tr 
                        key={h.symbol} 
                        className="clickable-row"
                        onClick={() => handleSelectHolding(h)}
                      >
                        <td className="stock-link">{h.symbol}</td>
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

      {/* Chart Modal */}
      {isChartOpen && selectedStock && (
        <div className="chart-modal" onClick={closeChart}>
          <div className="chart-shell" onClick={(event) => event.stopPropagation()}>
            <div className="chart-header">
              <div>
                <h3>{selectedStock.symbol} Chart</h3>
                <span className="muted">
                  {chartRange.interval.toUpperCase()} • {chartRange.period}
                </span>
              </div>
              <button className="icon-button" onClick={closeChart}>×</button>
            </div>
            <div className="chart-controls">
              <div className="chart-ranges">
                {CHART_RANGES.map((range) => (
                  <button
                    key={`${range.interval}-${range.period}`}
                    className={`chart-range ${chartRange.interval === range.interval && chartRange.period === range.period ? 'active' : ''}`}
                    onClick={() => setChartRange({ interval: range.interval, period: range.period })}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              <div className="chart-legend">
                <span className="legend-item sma">SMA 20</span>
                <span className="legend-item ema">EMA 20</span>
                <span className="legend-item rsi">RSI 14</span>
              </div>
            </div>
            {(chartStatus.loading || chartStatus.error) && (
              <div className="loading">
                {chartStatus.error || 'Loading chart...'}
              </div>
            )}
            <div className={`chart-content ${chartStatus.loading ? 'is-loading' : ''}`}>
              <div ref={candleContainerRef} className="chart-canvas"></div>
              <div ref={rsiContainerRef} className="chart-canvas small"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualTrading;
