import React, { useState, useEffect, useRef } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import { authApi, fastAuthApi } from '../lib/api.js';
import useAutoRefresh, { useRelativeTime } from '../hooks/useAutoRefresh';
import MarketStatus from './MarketStatus';
import OptionChain from './OptionChain';
import Wallet from './sections/Wallet';
import '../watchlist.css';

const API_BASE_URL = window.location.origin;
const CHART_RANGES = [
  { label: '5m', interval: '5m', period: '5d' },
  { label: '15m', interval: '15m', period: '1mo' },
  { label: '1D', interval: '1d', period: '6mo' },
];

const VirtualTrading = ({ initialTab = 'trade' }) => {
  // Map initialTab prop to internal tab names
  const getInitialTab = () => {
    switch (initialTab) {
      case 'trade': return 'stocks';
      case 'portfolio': return 'portfolio';
      case 'orders': return 'orders';
      default: return 'stocks';
    }
  };
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [stocks, setStocks] = useState([]);
  const [filteredStocks, setFilteredStocks] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPage, setSearchPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedStock, setSelectedStock] = useState(null);
  const [portfolio, setPortfolio] = useState([]);
  const [walletBalance, setWalletBalance] = useState(100000);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState({ stocks: false, portfolio: false, trade: false, wallet: false, fyers: false, watchlists: false });
  const [tradeForm, setTradeForm] = useState({ quantity: 1, price: '', orderType: 'market', broker: 'virtual' });
  const [walletSubSection, setWalletSubSection] = useState('balance');
  const [fyersConnected, setFyersConnected] = useState(false);
  const [fyersHoldings, setFyersHoldings] = useState([]);
  const [showFyersPortfolio, setShowFyersPortfolio] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '', show: false });
  
  // Watchlist states
  const [watchlists, setWatchlists] = useState([]);
  const [activeWatchlist, setActiveWatchlist] = useState(null);
  const [watchlistStocks, setWatchlistStocks] = useState([]);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [allStocksForSearch, setAllStocksForSearch] = useState([]);

  const [isChartOpen, setIsChartOpen] = useState(false);
  const [chartRange, setChartRange] = useState({ interval: '5m', period: '5d' });
  const [chartStatus, setChartStatus] = useState({ loading: false, error: '' });
  const [showIndicators, setShowIndicators] = useState({ sma: false, ema: false, rsi: false });
  const candleContainerRef = useRef(null);
  const volumeContainerRef = useRef(null);
  const rsiContainerRef = useRef(null);
  const chartRefs = useRef({
    chart: null,
    volumeChart: null,
    rsiChart: null,
    candleSeries: null,
    volumeSeries: null,
    smaSeries: null,
    emaSeries: null,
    rsiSeries: null,
  });

  const isModalOpen = Boolean(selectedStock) || isChartOpen || showAddStockModal;

  // Auto-refresh: Only stock prices for active watchlist + portfolio
  // 10 second interval to prevent request overlap
  const { lastUpdate: stocksUpdate } = useAutoRefresh('trading-stocks', () => refreshStocksSilent(), 10000);
  const stocksTime = useRelativeTime(stocksUpdate);

  // Silent refresh for stock prices only (watchlist + portfolio stocks)
  const refreshStocksSilent = async () => {
    if (!activeWatchlist) return;
    
    // Get symbols from active watchlist + portfolio
    const watchlistSymbols = watchlistStocks.map(s => s.symbol) || [];
    const portfolioSymbols = portfolio.map(p => p.symbol) || [];
    const symbols = [...new Set([...watchlistSymbols, ...portfolioSymbols])];
    
    if (symbols.length === 0) return;
    
    try {
      const res = await fastAuthApi(`${API_BASE_URL}/watchlist/${activeWatchlist.id}/stocks`);
      if (res?.stocks?.length > 0) {
        setWatchlistStocks(res.stocks);
      }
    } catch (err) {
      console.error('Failed to refresh watchlist stocks', err);
    }
  };

  useEffect(() => {
    document.body.classList.toggle('modal-open', isModalOpen);
    return () => document.body.classList.remove('modal-open');
  }, [isModalOpen]);

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
    if (chartRefs.current.volumeChart) {
      chartRefs.current.volumeChart.remove();
    }
    if (chartRefs.current.rsiChart) {
      chartRefs.current.rsiChart.remove();
    }
    chartRefs.current = {
      chart: null,
      volumeChart: null,
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
    const volumeChart = chartRefs.current.volumeChart;
    const rsiChart = chartRefs.current.rsiChart;
    const candleContainer = candleContainerRef.current;
    const volumeContainer = volumeContainerRef.current;
    const rsiContainer = rsiContainerRef.current;
    
    if (chart && candleContainer) {
      chart.applyOptions({
        width: candleContainer.clientWidth,
        height: candleContainer.clientHeight,
      });
    }
    if (volumeChart && volumeContainer) {
      volumeChart.applyOptions({
        width: volumeContainer.clientWidth,
        height: volumeContainer.clientHeight,
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
    if (chartRefs.current.chart && chartRefs.current.volumeChart) {
      resizeCharts();
      return true;
    }
    
    const candleContainer = candleContainerRef.current;
    if (!candleContainer) return false;
    
    const volumeContainer = volumeContainerRef.current;
    const rsiContainer = rsiContainerRef.current;

    // Create main candlestick chart
    chartRefs.current.chart = createChart(candleContainer, {
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
      timeScale: { timeVisible: true, visible: true },
      crosshair: { mode: CrosshairMode.Normal },
    });

    chartRefs.current.candleSeries = chartRefs.current.chart.addCandlestickSeries({
      upColor: '#00d09c',
      downColor: '#ff4d4d',
      wickUpColor: '#00d09c',
      wickDownColor: '#ff4d4d',
      borderVisible: false,
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

    // Create separate volume chart
    if (volumeContainer) {
      chartRefs.current.volumeChart = createChart(volumeContainer, {
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
        timeScale: { timeVisible: false, visible: false },
        crosshair: { mode: CrosshairMode.Normal },
      });

      chartRefs.current.volumeSeries = chartRefs.current.volumeChart.addHistogramSeries({
        priceFormat: { type: 'volume' },
        color: '#26a69a',
        priceScaleId: '',
      });

      // Sync volume chart time scale with main chart
      chartRefs.current.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && chartRefs.current.volumeChart) {
          chartRefs.current.volumeChart.timeScale().setVisibleLogicalRange(range);
        }
      });
    }

    // Create RSI chart only if container exists
    if (rsiContainer) {
      chartRefs.current.rsiChart = createChart(rsiContainer, {
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
        timeScale: { timeVisible: true, visible: true },
        crosshair: { mode: CrosshairMode.Normal },
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
        lineStyle: LineStyle.Dashed,
      });
      chartRefs.current.rsiSeries.createPriceLine({
        price: 30,
        color: '#ff4d4d',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
      });

      // Sync RSI chart time scale with main chart
      chartRefs.current.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (range && chartRefs.current.rsiChart) {
          chartRefs.current.rsiChart.timeScale().setVisibleLogicalRange(range);
        }
      });
    }

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
    // Only show indicators if enabled
    if (smaSeries) {
      smaSeries.setData(showIndicators.sma ? (data.indicators?.sma20 || []) : []);
    }
    if (emaSeries) {
      emaSeries.setData(showIndicators.ema ? (data.indicators?.ema20 || []) : []);
    }
    if (rsiSeries) {
      rsiSeries.setData(showIndicators.rsi ? (data.indicators?.rsi14 || []) : []);
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

  // Fetch portfolio summary (includes wallet balance)
  const fetchPortfolio = async () => {
    setLoading((l) => ({ ...l, portfolio: true }));
    try {
      const res = await authApi(`${API_BASE_URL}/portfolio/summary`);
      setPortfolio(res.holdings || []);
      setWalletBalance(res.wallet_balance || 100000);
    } catch (err) {
      console.error('Failed to load portfolio', err);
      // Fallback to basic portfolio endpoint
      try {
        const fallback = await authApi(`${API_BASE_URL}/portfolio`);
        setPortfolio(fallback.holdings || []);
      } catch (e) {
        showToast('Failed to load portfolio', 'error');
      }
    } finally {
      setLoading((l) => ({ ...l, portfolio: false }));
    }
  };

  // Fetch order history
  const fetchOrders = async () => {
    try {
      const res = await authApi(`${API_BASE_URL}/portfolio/orders?limit=20`);
      setOrders(res.orders || []);
    } catch (err) {
      console.error('Failed to load orders', err);
    }
  };

  // Fetch Fyers status and holdings
  const fetchFyersData = async () => {
    try {
      const statusRes = await authApi(`${API_BASE_URL}/fyers/status`);
      setFyersConnected(statusRes.connected);
      
      if (statusRes.connected) {
        setLoading(l => ({ ...l, fyers: true }));
        const holdingsRes = await authApi(`${API_BASE_URL}/fyers/holdings`);
        setFyersHoldings(holdingsRes.holdings || []);
        setLoading(l => ({ ...l, fyers: false }));
      }
    } catch (err) {
      console.error('Failed to fetch Fyers data', err);
      setLoading(l => ({ ...l, fyers: false }));
    }
  };

  // Fetch user watchlists
  const fetchWatchlists = async () => {
    setLoading(l => ({ ...l, watchlists: true }));
    try {
      const res = await authApi(`${API_BASE_URL}/watchlist`);
      const lists = res.watchlists || [];
      setWatchlists(lists);
      
      // Auto-select first watchlist if none selected
      if (lists.length > 0 && !activeWatchlist) {
        setActiveWatchlist(lists[0]);
        fetchWatchlistStocks(lists[0].id);
      } else if (lists.length === 0) {
        initializeWatchlists();
      }
    } catch (err) {
      console.error('Failed to load watchlists', err);
      showToast('Failed to load watchlists', 'error');
    } finally {
      setLoading(l => ({ ...l, watchlists: false }));
    }
  };

  // Fetch stocks in a watchlist
  const fetchWatchlistStocks = async (watchlistId) => {
    setLoading(l => ({ ...l, stocks: true }));
    try {
      const res = await authApi(`${API_BASE_URL}/watchlist/${watchlistId}/stocks`);
      setWatchlistStocks(res.stocks || []);
    } catch (err) {
      console.error('Failed to load watchlist stocks', err);
      showToast('Failed to load stocks', 'error');
    } finally {
      setLoading(l => ({ ...l, stocks: false }));
    }
  };

  // Create a new watchlist
  const createWatchlist = async () => {
    if (watchlists.length >= 15) {
      showToast('Maximum 15 watchlists allowed', 'error');
      return;
    }
    
    const name = `Watchlist ${watchlists.length + 1}`;
    const position = watchlists.length;
    
    try {
      const res = await authApi(`${API_BASE_URL}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, position }),
      });
      
      showToast(`Created ${name}`, 'success');
      fetchWatchlists();
    } catch (err) {
      console.error('Failed to create watchlist', err);
      showToast('Failed to create watchlist', 'error');
    }
  };

  // Initialize default watchlists for new users
  const initializeWatchlists = async () => {
    try {
      await authApi(`${API_BASE_URL}/watchlist/initialize`, {
        method: 'POST',
      });
      fetchWatchlists();
    } catch (err) {
      console.error('Failed to initialize watchlists', err);
    }
  };

  // Delete a watchlist
  const deleteWatchlist = async (watchlistId) => {
    if (watchlists.length === 1) {
      showToast('Cannot delete the last watchlist', 'error');
      return;
    }
    
    try {
      await authApi(`${API_BASE_URL}/watchlist/${watchlistId}`, {
        method: 'DELETE',
      });
      
      showToast('Watchlist deleted', 'success');
      
      // Switch to first watchlist if deleted was active
      if (activeWatchlist?.id === watchlistId) {
        const remaining = watchlists.filter(w => w.id !== watchlistId);
        if (remaining.length > 0) {
          setActiveWatchlist(remaining[0]);
          fetchWatchlistStocks(remaining[0].id);
        }
      }
      
      fetchWatchlists();
    } catch (err) {
      console.error('Failed to delete watchlist', err);
      showToast('Failed to delete watchlist', 'error');
    }
  };

  // Add stock to watchlist
  const addStockToWatchlist = async (symbol) => {
    if (!activeWatchlist) return;
    
    try {
      await authApi(`${API_BASE_URL}/watchlist/${activeWatchlist.id}/stocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      
      showToast(`Added ${symbol} to watchlist`, 'success');
      fetchWatchlistStocks(activeWatchlist.id);
      setShowAddStockModal(false);
    } catch (err) {
      console.error('Failed to add stock', err);
      showToast(err.message || 'Failed to add stock', 'error');
    }
  };

  // Remove stock from watchlist
  const removeStockFromWatchlist = async (symbol) => {
    if (!activeWatchlist) return;
    
    try {
      await authApi(`${API_BASE_URL}/watchlist/${activeWatchlist.id}/stocks/${symbol}`, {
        method: 'DELETE',
      });
      
      showToast(`Removed ${symbol} from watchlist`, 'success');
      fetchWatchlistStocks(activeWatchlist.id);
    } catch (err) {
      console.error('Failed to remove stock', err);
      showToast('Failed to remove stock', 'error');
    }
  };

  // Fetch all stocks for search modal
  const fetchAllStocksForSearch = async () => {
    try {
      const res = await authApi(`${API_BASE_URL}/nse_data/all-stocks`);
      setAllStocksForSearch(res.stocks || []);
    } catch (err) {
      console.error('Failed to load stocks for search', err);
    }
  };

  // Load more search results
  const handleLoadMore = async () => {
    if (loading.stocks || !hasMore) return;
    
    const nextPage = searchPage + 1;
    const query = searchQuery.toUpperCase();
    
    setLoading(l => ({...l, stocks: true}));
    try {
      const res = await fastAuthApi(`${API_BASE_URL}/nse_data/fno/search?query=${encodeURIComponent(query)}&page=${nextPage}&limit=20`);
      if (res.results) {
        const newMatches = res.results.map(i => ({
          symbol: i.identifier,
          lastPrice: i.ltp,
          pChange: i.pChange,
          isFno: true,
          ...i
        }));
        setFilteredStocks(prev => [...prev, ...newMatches]);
        setSearchPage(nextPage);
        setHasMore(newMatches.length === 20 && res.total > (nextPage * 20));
      }
    } catch (e) {
      console.error("Load more failed", e);
    } finally {
      setLoading(l => ({...l, stocks: false}));
    }
  };

  // Filter watchlist stocks by search
  // Global Search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStocks(allStocksForSearch.slice(0, 50));
    } else {
      const query = searchQuery.toUpperCase();
      
      // Local stock search
      const localMatches = allStocksForSearch.filter(s => s.symbol.includes(query)).slice(0, 20);
      
      // Perform Search
      const runSearch = async () => {
          setLoading(l => ({...l, stocks: true}));
          setSearchPage(1);
          setHasMore(false);
          
          let fnoMatches = [];
          // If query looks like F&O or Index
          if (/\d/.test(query) || /CE|PE|CALL|PUT/i.test(query) || /NIFTY|BANK/i.test(query)) {
               try {
                  const res = await fastAuthApi(`${API_BASE_URL}/nse_data/fno/search?query=${encodeURIComponent(query)}&page=1&limit=20`);
                  if (res.results) {
                      setHasMore(res.results.length === 20 && res.total > 20);
                      fnoMatches = res.results.map(i => ({
                          symbol: i.identifier,
                          lastPrice: i.ltp,
                          pChange: i.pChange,
                          isFno: true,
                          ...i
                      }));
                  }
               } catch (e) {
                   console.error("F&O Search failed", e);
               }
          }
          
          let combined = [];
          if (fnoMatches.length > 0) {
              combined = [...fnoMatches, ...localMatches];
          } else {
              combined = localMatches;
          }
          
          setFilteredStocks(combined);
          setLoading(l => ({...l, stocks: false}));
      };
      
      // debounce slightly
      const timer = setTimeout(runSearch, 300);
      return () => clearTimeout(timer);
    }
  }, [searchQuery, watchlistStocks, allStocksForSearch]);

  // Load data on mount
  useEffect(() => {
    fetchPortfolio();
    fetchFyersData();
    fetchAllStocksForSearch();
  }, []);

  // Note: Auto-refresh for stocks is handled by useAutoRefresh hook (line 56)
  // Portfolio refresh only happens on user action (mount, trade, or manual refresh)
  // This prevents unnecessary DB connections


  useEffect(() => {
    if (!isChartOpen || !selectedStock) return;
    
    // Initial load
    const ready = ensureCharts();
    if (ready) {
      loadChartData(selectedStock.symbol, chartRange.interval, chartRange.period);
    }

    // Auto-refresh chart every 60 seconds
    const interval = setInterval(() => {
      if (ready) {
        loadChartData(selectedStock.symbol, chartRange.interval, chartRange.period);
      }
    }, 60000);

    return () => clearInterval(interval);
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
    setTradeForm({ quantity: 1, price: stock.lastPrice?.toFixed(2) || '', orderType: 'market' });
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
    setTradeForm({ quantity: holding.quantity, price: stockFromHolding.lastPrice?.toFixed(2) || '', orderType: 'market' });
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
      if (tradeForm.broker === 'fyers') {
        const payload = {
          symbol: `NSE:${selectedStock.symbol}-EQ`,
          qty: parseInt(tradeForm.quantity),
          type: tradeForm.orderType === 'market' ? 2 : 1, // 1 for Limit, 2 for Market
          side: side === 'BUY' ? 1 : -1,
          productType: 'CNC',
          limitPrice: tradeForm.orderType === 'limit' ? parseFloat(tradeForm.price) : 0,
          stopPrice: 0,
          validity: 'DAY',
          disclosedQty: 0,
          offlineOrder: false,
        };
        const res = await authApi(`${API_BASE_URL}/fyers/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res && res.s === 'ok') {
          showToast(`Live ${side} Order Placed on Fyers: ${res.id}`, 'success');
        } else {
          showToast(`Fyers Error: ${res?.message || 'Order failed'}`, 'error');
        }
      } else {
        const payload = {
          symbol: selectedStock.symbol,
          quantity: parseInt(tradeForm.quantity),
          price: parseFloat(tradeForm.price),
          side: side,
          order_type: tradeForm.orderType.toUpperCase(),
          limit_price: tradeForm.orderType === 'limit' ? parseFloat(tradeForm.price) : null,
        };
        const res = await authApi(`${API_BASE_URL}/portfolio/trade`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        setPortfolio(res.holdings || []);
        if (res.wallet_balance !== undefined) {
          setWalletBalance(res.wallet_balance);
        }
        const orderTypeLabel = tradeForm.orderType === 'limit' ? '(Limit)' : '(Market)';
        showToast(`${side} ${tradeForm.quantity} ${selectedStock.symbol} @ ₹${parseFloat(res.order?.price || tradeForm.price).toFixed(2)} ${orderTypeLabel}`, 'success');
      }
      
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
      <div className="section-tabs" style={{marginBottom: '1rem', display: 'flex', gap: '8px', borderBottom: '1px solid #444c56', paddingBottom: '8px', overflowX: 'auto'}}>
         <button 
           className={`virtual-tab ${activeTab === 'stocks' ? 'active' : ''}`}
           onClick={() => setActiveTab('stocks')}
         >Trade</button>
         <button 
           className={`virtual-tab ${activeTab === 'portfolio' ? 'active' : ''}`}
           onClick={() => setActiveTab('portfolio')}
         >Portfolio</button>
         <button 
           className={`virtual-tab ${activeTab === 'orders' ? 'active' : ''}`}
           onClick={() => setActiveTab('orders')}
         >Orders</button>
         <button 
           className={`virtual-tab ${activeTab === 'fno' ? 'active' : ''}`}
           onClick={() => setActiveTab('fno')}
         >Option Chain</button>
         <button 
           className={`virtual-tab ${activeTab === 'wallet' ? 'active' : ''}`}
           onClick={() => setActiveTab('wallet')}
         >Wallet</button>
      </div>


      {/* Stocks & Trading Tab - Watchlist View */}
      {activeTab === 'stocks' && (
        <div className="virtual-stocks-container">
          {/* Market Status Bar (Indices) */}
          <MarketStatus />

          {/* Watchlist Tabs */}
          <div className="watchlist-tabs-container">
            <div className="watchlist-tabs">
              {watchlists.map((wl) => (
                <button
                  key={wl.id}
                  className={`watchlist-tab ${activeWatchlist?.id === wl.id ? 'active' : ''}`}
                  onClick={() => {
                    setActiveWatchlist(wl);
                    fetchWatchlistStocks(wl.id);
                  }}
                  onDoubleClick={() => {
                    const newName = prompt('Rename watchlist:', wl.name);
                    if (newName && newName.trim()) {
                      authApi(`${API_BASE_URL}/watchlist/${wl.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: newName.trim() }),
                      }).then(() => {
                        showToast('Watchlist renamed', 'success');
                        fetchWatchlists();
                      }).catch(() => showToast('Failed to rename', 'error'));
                    }
                  }}
                >
                  {wl.name}
                  <span className="watchlist-count">{wl.stock_count || 0}</span>
                </button>
              ))}
              {watchlists.length < 15 && (
                <button 
                  className="watchlist-tab add-tab"
                  onClick={createWatchlist}
                  title="Create new watchlist"
                >
                  +
                </button>
              )}
            </div>
            {activeWatchlist && watchlists.length > 1 && (
              <button 
                className="delete-watchlist-btn"
                onClick={() => {
                  if (confirm(`Delete "${activeWatchlist.name}"?`)) {
                    deleteWatchlist(activeWatchlist.id);
                  }
                }}
                title="Delete watchlist"
              >
                🗑️
              </button>
            )}
          </div>

          {/* Header */}
          <div className="virtual-stocks-header">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <p className="eyebrow">{activeWatchlist?.name || 'WATCHLIST'}</p>
                <div className="live-badge">
                  <span className="pulse-dot"></span>
                  LIVE
                </div>
              </div>
              <h2>Pick a stock to trade</h2>
              <p className="muted">Search within watchlist or add new stocks</p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="primary-btn"
                onClick={() => {
                  setShowAddStockModal(true);
                  fetchAllStocksForSearch();
                }}
              >
                + Add Stock
              </button>
              <button 
                className="secondary-btn"
                onClick={() => setActiveTab('fno')}
              >
                Option Chain
              </button>
              <button 
                className="ghost-btn" 
                onClick={() => activeWatchlist && fetchWatchlistStocks(activeWatchlist.id)} 
                disabled={loading.stocks}
              >
                {loading.stocks ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="search-row">
            <input
              type="text"
              placeholder="Search stocks, indices, or F&O (e.g. NIFTY 26000)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Stock Grid */}
          <div className="stock-grid">
            {loading.stocks ? (
              <div className="loading">Loading stocks...</div>
            ) : !activeWatchlist ? (
              <div className="loading">Create a watchlist to get started</div>
            ) : filteredStocks.length === 0 ? (
              <div className="loading">
                {searchQuery ? 'No stocks found' : 'No stocks in this watchlist. Click "Add Stock" to add some.'}
              </div>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {stock.isFno ? (
                        <div className="fno-actions" style={{display: 'flex', gap: '4px'}}>
                           <button 
                             style={{background:'#00d09c', color:'black', border:'none', borderRadius:'4px', padding:'2px 8px', fontSize:'12px', fontWeight:'bold', cursor:'pointer'}}
                             onClick={(e) => { e.stopPropagation(); handleSelectStock(stock); }}
                           >B</button>
                           <button 
                             style={{background:'#ff4d4d', color:'white', border:'none', borderRadius:'4px', padding:'2px 8px', fontSize:'12px', fontWeight:'bold', cursor:'pointer'}}
                             onClick={(e) => { e.stopPropagation(); handleSelectStock(stock); }}
                           >S</button>
                        </div>
                    ) : (
                        <span className={`stock-change ${stock.pChange >= 0 ? 'positive' : 'negative'}`}>
                           {stock.pChange >= 0 ? '+' : ''}{Number(stock.pChange || 0).toFixed(2)}%
                        </span>
                    )}
                    
                    {!stock.isFno && !searchQuery && (
                        <button
                          className="remove-stock-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Remove ${stock.symbol} from watchlist?`)) {
                              removeStockFromWatchlist(stock.symbol);
                            }
                          }}
                          title="Remove from watchlist"
                        >
                          ×
                        </button>
                    )}
                  </div>
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
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ margin: 0 }}>{selectedStock.symbol}</h3>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  <button 
                    className={`broker-toggle ${tradeForm.broker === 'virtual' ? 'active' : ''}`}
                    onClick={() => setTradeForm({ ...tradeForm, broker: 'virtual' })}
                  >
                    Virtual
                  </button>
                  {fyersConnected && (
                    <button 
                      className={`broker-toggle ${tradeForm.broker === 'fyers' ? 'active' : ''}`}
                      onClick={() => setTradeForm({ ...tradeForm, broker: 'fyers' })}
                    >
                      Fyers
                    </button>
                  )}
                </div>
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

              {/* Order Type Selector */}
              <div className="order-type-selector">
                <button
                  className={`order-type-btn ${tradeForm.orderType === 'market' ? 'active' : ''}`}
                  onClick={() => setTradeForm({
                    ...tradeForm,
                    orderType: 'market',
                    price: selectedStock.lastPrice?.toFixed(2) || ''
                  })}
                >
                  Market Order
                </button>
                <button
                  className={`order-type-btn ${tradeForm.orderType === 'limit' ? 'active' : ''}`}
                  onClick={() => setTradeForm({ ...tradeForm, orderType: 'limit' })}
                >
                  Limit Order
                </button>
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
                  <label>
                    {tradeForm.orderType === 'market' ? 'Market Price (₹)' : 'Limit Price (₹)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={tradeForm.price}
                    onChange={(e) => setTradeForm({ ...tradeForm, price: e.target.value })}
                    disabled={tradeForm.orderType === 'market'}
                    className={tradeForm.orderType === 'market' ? 'price-disabled' : ''}
                  />
                  {tradeForm.orderType === 'limit' && (
                    <span className="limit-hint">Enter your desired price</span>
                  )}
                </div>
              </div>

              {/* Wallet Balance */}
              <div className="stock-trade-wallet">
                <span>Available Balance</span>
                <span className="stock-trade-wallet-value">
                  ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>

              {/* Order Info for Limit Orders */}
              {tradeForm.orderType === 'limit' && (
                <div className="limit-order-info">
                  <span className="info-icon">ℹ️</span>
                  <span>Limit order will execute at ₹{tradeForm.price || '0.00'} or better</span>
                </div>
              )}

              {/* Total */}
              <div className="stock-trade-total">
                <span>Order Value</span>
                <span className={`stock-trade-total-value ${((tradeForm.quantity || 0) * (parseFloat(tradeForm.price) || 0)) > walletBalance ? 'negative' : 'positive'}`}>
                  ₹{((tradeForm.quantity || 0) * (parseFloat(tradeForm.price) || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
              <h2>Portfolio</h2>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                <button 
                  className={`virtual-tab mini ${!showFyersPortfolio ? 'active' : ''}`}
                  onClick={() => setShowFyersPortfolio(false)}
                >
                  Virtual
                </button>
                {fyersConnected && (
                  <button 
                    className={`virtual-tab mini ${showFyersPortfolio ? 'active' : ''}`}
                    onClick={() => { setShowFyersPortfolio(true); fetchFyersData(); }}
                  >
                    Fyers Real
                  </button>
                )}
              </div>
            </div>
            <button className="ghost-btn" onClick={() => showFyersPortfolio ? fetchFyersData() : fetchPortfolio()} disabled={loading.portfolio || loading.fyers}>
              {(loading.portfolio || loading.fyers) ? 'Loading...' : 'Refresh'}
            </button>
          </div>

          {!showFyersPortfolio ? (
            <>
              <div className="portfolio-summary">
                <div className="summary-card wallet">
                  <span className="label">Wallet Balance</span>
                  <span className="value">₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="summary-card">
                  <span className="label">Holdings Value</span>
                  <span className="value">₹{totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className={`summary-card ${totalPnL >= 0 ? 'positive' : 'negative'}`}>
                  <span className="label">Total P&L</span>
                  <span className="value">
                    {totalPnL >= 0 ? '+' : ''}₹{totalPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="summary-card highlight">
                  <span className="label">Net Worth</span>
                  <span className="value">₹{(walletBalance + totalValue).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
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
            </>
          ) : (
            <>
              <div className="portfolio-summary">
                <div className="summary-card highlight">
                  <span className="label">Fyers Balance</span>
                  <span className="value">₹--</span>
                </div>
                <div className="summary-card">
                  <span className="label">Live Holdings</span>
                  <span className="value">{fyersHoldings.length} Positions</span>
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
                    {loading.fyers ? (
                      <tr>
                        <td colSpan="5" className="loading">Fetching data from Fyers...</td>
                      </tr>
                    ) : fyersHoldings.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="loading">No holdings found in your Fyers account.</td>
                      </tr>
                    ) : (
                      fyersHoldings.map((h, idx) => {
                        const pnl = (h.lp - h.costPrice) * h.quantity;
                        const pnlClass = pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : '';
                        return (
                          <tr key={h.symbol + idx}>
                            <td>{h.symbol.replace('NSE:', '').replace('-EQ', '')}</td>
                            <td className="text-right">{h.quantity}</td>
                            <td className="text-right">₹{Number(h.costPrice).toFixed(2)}</td>
                            <td className="text-right">₹{Number(h.lp).toFixed(2)}</td>
                            <td className={`text-right ${pnlClass}`}>
                              {pnl >= 0 ? '+' : ''}₹{Number(pnl).toFixed(2)}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}


      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="portfolio-section">
          <div className="portfolio-header">
            <div>
              <h2>Order History</h2>
              <p className="muted">View all your virtual trades</p>
            </div>
            <button className="ghost-btn" onClick={fetchOrders}>
              Refresh
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Symbol</th>
                  <th>Type</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="loading">No orders yet. Start trading!</td>
                  </tr>
                ) : (
                  orders.map((order, idx) => {
                    const date = order.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    }) : '-';
                    return (
                      <tr key={order.id || idx}>
                        <td>{date}</td>
                        <td>{order.symbol}</td>
                        <td>
                          <span className={`order-side ${order.side?.toLowerCase()}`}>
                            {order.side}
                          </span>
                        </td>
                        <td className="text-right">{order.quantity}</td>
                        <td className="text-right">₹{Number(order.price || 0).toFixed(2)}</td>
                        <td className="text-right">₹{Number(order.total_value || 0).toLocaleString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Option Chain Tab */}
      {activeTab === 'fno' && (
        <OptionChain 
          symbol="NIFTY" 
          onClose={() => setActiveTab('stocks')} 
          onSelectToken={(token) => {
              const stockObj = {
                  symbol: token.identifier || `${token.symbol} ${token.expiry} ${token.strike} ${token.type}`,
                  lastPrice: token.ltp,
                  pChange: token.pChange,
                  isFno: true
              };
              // Default lot size logic? Nifty 50, BankNifty 15.
              let qty = 1;
              if (token.symbol === 'NIFTY') qty = 50;
              else if (token.symbol === 'BANKNIFTY') qty = 15;
              
              setSelectedStock(stockObj);
              setTradeForm({
                  quantity: qty,
                  price: stockObj.lastPrice?.toFixed(2) || '',
                  orderType: 'market',
                  broker: 'virtual'
              });
          }}
        />
      )}

      {/* Wallet Tab */}
      {activeTab === 'wallet' && (
        <div className="wallet-container" style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
           <div className="wallet-nav" style={{display: 'flex', gap: '1rem', padding: '0.5rem 0', marginBottom: '1rem'}}>
              <button 
                className={`secondary-btn ${walletSubSection === 'balance' ? 'active-sub' : ''}`}
                style={{borderColor: walletSubSection === 'balance' ? '#00d09c' : '#444c56'}}
                onClick={() => setWalletSubSection('balance')}
              >Overview</button>
              <button 
                className={`secondary-btn ${walletSubSection === 'funds' ? 'active-sub' : ''}`}
                style={{borderColor: walletSubSection === 'funds' ? '#00d09c' : '#444c56'}}
                onClick={() => setWalletSubSection('funds')}
              >Add Funds</button>
              <button 
                className={`secondary-btn ${walletSubSection === 'transactions' ? 'active-sub' : ''}`}
                style={{borderColor: walletSubSection === 'transactions' ? '#00d09c' : '#444c56'}}
                onClick={() => setWalletSubSection('transactions')}
              >Transactions</button>
           </div>
           <Wallet 
             subSection={walletSubSection} 
             onNavigate={(target) => {
                 if (target && target.includes('funds')) setWalletSubSection('funds');
                 else if (target && target.includes('transactions')) setWalletSubSection('transactions');
                 else setWalletSubSection('balance');
             }}
           />
        </div>
      )}

      {/* Add Stock Modal */}
      {showAddStockModal && (
        <div className="stock-trade-modal" onClick={() => setShowAddStockModal(false)}>
          <div className="stock-trade-shell" onClick={(e) => e.stopPropagation()}>
            <div className="stock-trade-header">
              <h3>Add Stock to {activeWatchlist?.name}</h3>
              <button className="icon-button" onClick={() => setShowAddStockModal(false)}>×</button>
            </div>

            <div className="stock-trade-content">
              {/* Search for stocks */}
              <div className="search-row">
                <input
                  type="text"
                  placeholder="Search all NSE stocks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-input"
                  autoFocus
                />
              </div>

              {/* Available stocks list */}
              {/* Available stocks list */}
              <div className="add-stock-list">
                {filteredStocks.length === 0 && !loading.stocks ? (
                  <div className="loading">No stocks found</div>
                ) : (
                  filteredStocks.map((stock) => {
                    const existingSymbols = new Set(watchlistStocks.map(s => s.symbol));
                    const alreadyAdded = existingSymbols.has(stock.symbol);
                    return (
                      <div
                        key={stock.symbol}
                        className={`add-stock-item ${alreadyAdded ? 'disabled' : ''}`}
                        onClick={() => !alreadyAdded && addStockToWatchlist(stock.symbol)}
                      >
                        <div className="stock-info">
                          <span className="stock-symbol">{stock.symbol}</span>
                          <span className="stock-price">₹{Number(stock.lastPrice || 0).toFixed(2)}</span>
                          {stock.isFno && <span className="fno-badge" style={{fontSize: '0.7rem', background: '#333', padding: '2px 4px', borderRadius: '4px', marginLeft: '6px', color: '#888'}}>F&O</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className={`stock-change ${stock.pChange >= 0 ? 'positive' : 'negative'}`}>
                            {stock.pChange >= 0 ? '+' : ''}{Number(stock.pChange || 0).toFixed(2)}%
                          </span>
                          {alreadyAdded ? (
                            <span className="added-badge">✓ Added</span>
                          ) : (
                            <button className="add-btn-small" onClick={(e) => {
                              e.stopPropagation();
                              addStockToWatchlist(stock.symbol);
                            }}>
                              + Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {hasMore && (
                  <button 
                    className="load-more-btn" 
                    onClick={handleLoadMore} 
                    disabled={loading.stocks}
                    style={{
                      width: '100%',
                      padding: '10px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px dashed rgba(255, 255, 255, 0.1)',
                      borderRadius: '8px',
                      color: '#888',
                      marginTop: '10px',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {loading.stocks ? 'Loading...' : 'Load More Results'}
                  </button>
                )}
              </div>
            </div>
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
                <button 
                  className={`legend-item sma ${showIndicators.sma ? 'active' : ''}`}
                  onClick={() => setShowIndicators(prev => ({ ...prev, sma: !prev.sma }))}
                >
                  SMA 20 {showIndicators.sma ? '✓' : ''}
                </button>
                <button 
                  className={`legend-item ema ${showIndicators.ema ? 'active' : ''}`}
                  onClick={() => setShowIndicators(prev => ({ ...prev, ema: !prev.ema }))}
                >
                  EMA 20 {showIndicators.ema ? '✓' : ''}
                </button>
                <button 
                  className={`legend-item rsi ${showIndicators.rsi ? 'active' : ''}`}
                  onClick={() => setShowIndicators(prev => ({ ...prev, rsi: !prev.rsi }))}
                >
                  RSI 14 {showIndicators.rsi ? '✓' : ''}
                </button>
              </div>
            </div>
            {(chartStatus.loading || chartStatus.error) && (
              <div className="loading">
                {chartStatus.error || 'Loading chart...'}
              </div>
            )}
            <div className={`chart-content ${chartStatus.loading ? 'is-loading' : ''}`}>
              <div ref={candleContainerRef} className="chart-canvas"></div>
              <div ref={volumeContainerRef} className="chart-canvas volume"></div>
              {showIndicators.rsi && <div ref={rsiContainerRef} className="chart-canvas small"></div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualTrading;
