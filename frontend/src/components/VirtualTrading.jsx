import React, { useState, useEffect, useCallback, useRef } from 'react';
import { authApi, fastAuthApi } from '../lib/api.js';
import { useLoading } from '../contexts/LoadingContext.jsx';
import useAutoRefresh, { useRelativeTime } from '../hooks/useAutoRefresh';
import MarketStatus from './MarketStatus';
import OptionChain from './OptionChain';
import Wallet from './sections/Wallet';
import '../watchlist.css';

// Sub-components
import ChartModal from './trading/ChartModal.jsx';
import TradeModal from './trading/TradeModal.jsx';
import MarketView from './trading/MarketView.jsx';
import PortfolioView from './trading/PortfolioView.jsx';
import OrdersView from './trading/OrdersView.jsx';

const API_BASE_URL = window.location.origin;

const VirtualTrading = ({ initialTab = 'trade', mode = 'virtual' }) => {
  const isLive = mode === 'real';
  // Map initialTab prop to internal tab names
  const getInitialTab = () => {
    switch (initialTab) {
      case 'trade': return 'stocks';
      case 'portfolio': return 'portfolio';
      case 'orders': return 'orders';
      case 'fno': return 'fno';
      case 'wallet': return 'wallet';
      default: return 'stocks';
    }
  };
  
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const { showLoading, hideLoading } = useLoading();
  
  // Data State
  const [stocks, setStocks] = useState([]);
  const [filteredStocks, setFilteredStocks] = useState([]);
  const [portfolio, setPortfolio] = useState([]);
  const [orders, setOrders] = useState([]);
  const [walletBalance, setWalletBalance] = useState(100000);
  const [fyersHoldings, setFyersHoldings] = useState([]);
  
  // UI State
  const [loading, setLoading] = useState({ 
    stocks: false, 
    portfolio: false, 
    trade: false, 
    wallet: false, 
    fyers: false, 
    watchlists: false 
  });
  
  const [searchPage, setSearchPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [toast, setToast] = useState({ message: '', type: '', show: false });
  const [walletSubSection, setWalletSubSection] = useState('balance');
  
  // Selection State
  const [selectedStock, setSelectedStock] = useState(null);
  const [isChartOpen, setIsChartOpen] = useState(false);
  
  // Watchlist State
  const [watchlists, setWatchlists] = useState([]);
  const [activeWatchlist, setActiveWatchlist] = useState(null);
  const [watchlistStocks, setWatchlistStocks] = useState([]);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [allStocksForSearch, setAllStocksForSearch] = useState([]);
  const [modalSearchQuery, setModalSearchQuery] = useState(''); // Separate search state for Add Stock modal

  // Watchlist cache for fast tab switching
  const watchlistCache = useRef({});

  // Fyers State
  const [fyersConnected, setFyersConnected] = useState(false);
  const [showFyersPortfolio, setShowFyersPortfolio] = useState(false);

  // Auto-refresh hook
  const { lastUpdate: stocksUpdate } = useAutoRefresh('trading-stocks', () => refreshStocksSilent(), 10000);
  const stocksTime = useRelativeTime(stocksUpdate);

  // --- INITIALIZATION ---
  useEffect(() => {
    fetchPortfolio();
    fetchFyersData();
    fetchWatchlists(); // This will auto-select first watchlist and load stocks
    authApi(`${API_BASE_URL}/fyers/status`).then(res => setFyersConnected(res.connected)).catch(() => {});
  }, []);

  // Auto-fetch orders when switching to orders tab
  useEffect(() => {
    if (activeTab === 'orders') {
      fetchOrders();
    }
  }, [activeTab]);

  // --- DATA FETCHING ---

  // Silent refresh for stock prices only (watchlist + portfolio stocks) using Fyers
  const refreshStocksSilent = async () => {
    if (!activeWatchlist) return;

    // Get symbols from active watchlist + portfolio
    const watchlistSymbols = watchlistStocks.map(s => s.symbol) || [];
    const portfolioSymbols = portfolio.map(p => p.symbol) || [];
    const symbols = [...new Set([...watchlistSymbols, ...portfolioSymbols])];

    if (symbols.length === 0) return;

    try {
      // Use Fyers quotes endpoint for live price refresh
      const symbolsParam = symbols.slice(0, 50).join(','); // Max 50 symbols
      const res = await fastAuthApi(`${API_BASE_URL}/fyers/market/quotes?symbols=${encodeURIComponent(symbolsParam)}`);

      if (res?.fyers_connected !== undefined) {
        setFyersConnected(res.fyers_connected);
      }
      if (res?.quotes && res.fyers_connected) {
        // Merge new prices with existing watchlist stocks
        const updatedStocks = watchlistStocks.map(stock => {
          const quote = res.quotes[stock.symbol];
          if (quote) {
            return {
              ...stock,
              lastPrice: quote.lastPrice,
              pChange: quote.pChange,
              change: quote.change,
              high: quote.high,
              low: quote.low,
              volume: quote.volume
            };
          }
          return stock;
        });

        // Only update if prices actually changed
        const hasChanges = updatedStocks.some((stock, i) =>
            stock.lastPrice !== watchlistStocks[i]?.lastPrice ||
            stock.pChange !== watchlistStocks[i]?.pChange
        );
        if (hasChanges) {
            setWatchlistStocks(updatedStocks);

            // Also update portfolio holdings with live prices
            if (portfolio.length > 0) {
              const updatedPortfolio = portfolio.map(h => {
                const quote = res.quotes[h.symbol];
                return quote ? { ...h, ltp: quote.lastPrice } : h;
              });
              setPortfolio(updatedPortfolio);
            }
        }
      }
    } catch (err) {
      console.error('Failed to refresh watchlist stocks', err);
    }
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast({ message: '', type: '', show: false }), 3000);
  };

  // Helper: enrich holdings with Fyers live prices
  const enrichWithFyersPrices = async (holdings) => {
    if (!holdings || holdings.length === 0) return holdings;
    try {
      const symbols = holdings.map(h => h.symbol).slice(0, 50).join(',');
      const priceRes = await fastAuthApi(`${API_BASE_URL}/fyers/market/quotes?symbols=${encodeURIComponent(symbols)}`);
      if (priceRes?.quotes && priceRes.fyers_connected) {
        return holdings.map(h => {
          const quote = priceRes.quotes[h.symbol];
          return quote ? { ...h, ltp: quote.lastPrice } : h;
        });
      }
    } catch (err) {
      console.error('Failed to enrich portfolio prices via Fyers', err);
    }
    return holdings;
  };

  const fetchPortfolio = async () => {
    setLoading((l) => ({ ...l, portfolio: true }));
    try {
      const res = await authApi(`${API_BASE_URL}/portfolio/summary`);
      setWalletBalance(res.wallet_balance || 100000);
      // Enrich holdings with Fyers live prices (backend yfinance can't resolve F&O symbols)
      const enriched = await enrichWithFyersPrices(res.holdings || []);
      setPortfolio(enriched);
    } catch (err) {
      console.error('Failed to load portfolio', err);
      try {
        const fallback = await authApi(`${API_BASE_URL}/portfolio`);
        const enriched = await enrichWithFyersPrices(fallback.holdings || []);
        setPortfolio(enriched);
      } catch (e) {
        showToast('Failed to load portfolio', 'error');
      }
    } finally {
      setLoading((l) => ({ ...l, portfolio: false }));
    }
  };

  const fetchOrders = async () => {
    setLoading((l) => ({ ...l, orders: true })); // Added loader state for orders
    try {
      const res = await authApi(`${API_BASE_URL}/portfolio/orders?limit=20`);
      setOrders(res.orders || []);
    } catch (err) {
      console.error('Failed to load orders', err);
    } finally {
       setLoading((l) => ({ ...l, orders: false }));
    }
  };

  const fetchFyersData = async () => {
    try {
      const statusRes = await authApi(`${API_BASE_URL}/fyers/status`);
      setFyersConnected(statusRes.connected);
      
      if (statusRes.connected && showFyersPortfolio) {
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

  // --- WATCHLIST LOGIC ---
  
  const fetchWatchlists = async (selectId = null) => {
    setLoading(l => ({ ...l, watchlists: true }));
    try {
      const res = await authApi(`${API_BASE_URL}/watchlist`);
      const lists = res.watchlists || [];
      setWatchlists(lists);

      if (lists.length === 0) {
        setActiveWatchlist(null);
        setWatchlistStocks([]);
        return;
      }

      // If a specific ID requested (e.g. after create), select it
      if (selectId) {
        const target = lists.find(w => w.id === selectId);
        if (target) {
          setActiveWatchlist(target);
          fetchWatchlistStocks(target.id);
          return;
        }
      }

      // If current activeWatchlist still exists in the new list, keep it
      if (activeWatchlist && lists.some(w => w.id === activeWatchlist.id)) {
        return;
      }

      // Otherwise select first
      setActiveWatchlist(lists[0]);
      fetchWatchlistStocks(lists[0].id);
    } catch (err) {
      console.error('Failed to load watchlists', err);
      showToast('Failed to load watchlists', 'error');
    } finally {
      setLoading(l => ({ ...l, watchlists: false }));
    }
  };

  const fetchWatchlistStocks = async (watchlistId) => {
    setLoading(l => ({ ...l, stocks: true }));
    try {
      const res = await authApi(`${API_BASE_URL}/watchlist/${watchlistId}/stocks`);
      const stocks = res.stocks || [];

      // Fetch prices BEFORE setting state (single render)
      let finalStocks = stocks;
      if (stocks.length > 0) {
        try {
          const symbols = stocks.map(s => s.symbol).slice(0, 50).join(',');
          const priceRes = await fastAuthApi(`${API_BASE_URL}/fyers/market/quotes?symbols=${encodeURIComponent(symbols)}`);
          if (priceRes?.fyers_connected !== undefined) {
            setFyersConnected(priceRes.fyers_connected);
          }
          if (priceRes?.quotes && priceRes.fyers_connected) {
            finalStocks = stocks.map(stock => {
              const quote = priceRes.quotes[stock.symbol];
              return quote ? { ...stock, lastPrice: quote.lastPrice, pChange: quote.pChange, change: quote.change, high: quote.high, low: quote.low, volume: quote.volume } : stock;
            });
          }
          if (priceRes && !priceRes.fyers_connected) {
            showToast('Connect Fyers for live market prices', 'info');
          }
        } catch (priceErr) {
          console.error('Failed to fetch initial prices', priceErr);
        }
      }

      setWatchlistStocks(finalStocks);  // Single setState!
      watchlistCache.current[watchlistId] = finalStocks;  // Cache for fast tab switching
    } catch (err) {
      console.error('Failed to load watchlist stocks', err);
      showToast('Failed to load stocks', 'error');
    } finally {
      setLoading(l => ({ ...l, stocks: false }));
    }
  };

  const createWatchlist = async () => {
    if (watchlists.length >= 15) {
      showToast('Maximum 15 watchlists allowed', 'error');
      return;
    }
    if (loading.watchlists) return;
    setLoading(l => ({ ...l, watchlists: true }));
    const name = `Watchlist ${watchlists.length + 1}`;
    try {
      const res = await authApi(`${API_BASE_URL}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, position: watchlists.length }),
      });
      showToast(`Created ${name}`, 'success');
      await fetchWatchlists(res.id);
    } catch (err) {
       showToast('Failed to create watchlist', 'error');
    } finally {
      setLoading(l => ({ ...l, watchlists: false }));
    }
  };

  const deleteWatchlist = async (watchlistId) => {
    const watchlistToDelete = watchlists.find(w => w.id === watchlistId);

    if (watchlistToDelete?.is_default) {
      showToast('Cannot delete the default watchlist', 'error');
      return;
    }
    if (loading.watchlists) return;
    setLoading(l => ({ ...l, watchlists: true }));

    try {
      await authApi(`${API_BASE_URL}/watchlist/${watchlistId}`, { method: 'DELETE' });
      showToast('Watchlist deleted', 'success');

      if (activeWatchlist?.id === watchlistId) {
        setActiveWatchlist(null);
      }
      await fetchWatchlists();
    } catch (err) {
      showToast('Failed to delete', 'error');
    } finally {
      setLoading(l => ({ ...l, watchlists: false }));
    }
  };

  const addStockToWatchlist = async (symbol) => {
    if (!activeWatchlist) return;
    try {
      await authApi(`${API_BASE_URL}/watchlist/${activeWatchlist.id}/stocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      showToast(`Added ${symbol}`, 'success');
      // Optimistic update - add to local state
      setWatchlistStocks(prev => [...prev, { symbol, ltp: null, change: null, pChange: null }]);
      // Fetch price for just this one stock in background
      fastAuthApi(`${API_BASE_URL}/fyers/market/quotes?symbols=${encodeURIComponent(symbol)}`).then(priceRes => {
        if (priceRes?.quotes && priceRes.quotes[symbol]) {
          setWatchlistStocks(prev => prev.map(s => s.symbol === symbol ? { ...s, ...priceRes.quotes[symbol], lastPrice: priceRes.quotes[symbol].lastPrice } : s));
        }
      });
    } catch (err) {
      showToast('Failed to add stock', 'error');
    }
  };

  const removeStockFromWatchlist = async (symbol) => {
    if (!activeWatchlist) return;
    try {
      await authApi(`${API_BASE_URL}/watchlist/${activeWatchlist.id}/stocks/${encodeURIComponent(symbol)}`, { method: 'DELETE' });
      showToast(`Removed ${symbol}`, 'success');
      // Optimistic update - remove from local state
      setWatchlistStocks(prev => prev.filter(s => s.symbol !== symbol));
    } catch (err) {
      showToast('Failed to remove stock', 'error');
    }
  };

  // --- SEARCH LOGIC ---

  const fetchAllStocksForSearch = async () => {
    try {
      // Use Fyers market data endpoint for stock search
      const res = await authApi(`${API_BASE_URL}/fyers/market/all-stocks`);
      setAllStocksForSearch(res.stocks || []);

      // Notify if Fyers is not connected
      if (!res.fyers_connected) {
        console.log('[VirtualTrading] Fyers not connected - showing stocks without live prices');
      }
    } catch (err) {
      console.error('Failed to load stocks for search', err);
    }
  };

  const handleLoadMore = async () => {
    if (loading.stocks || !hasMore) return;
    const nextPage = searchPage + 1;
    const query = modalSearchQuery.toUpperCase();
    
    setLoading(l => ({...l, stocks: true}));
    try {
      const res = await fastAuthApi(`${API_BASE_URL}/nse_data/fno/search?query=${encodeURIComponent(query)}&page=${nextPage}&limit=20`);
      if (res.results) {
        const newMatches = res.results.map(i => ({
          ...i,
          symbol: i.identifier,
          lastPrice: i.ltp,
          pChange: i.pChange,
          isFno: true,
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

  // Lazy-load all stocks when Add Stock modal opens
  useEffect(() => {
    if (showAddStockModal && allStocksForSearch.length === 0) {
      fetchAllStocksForSearch();
    }
  }, [showAddStockModal]);

  // Update filtered stocks for Add Stock modal only
  useEffect(() => {
    if (!showAddStockModal) return;

    if (!modalSearchQuery.trim()) {
      setFilteredStocks(allStocksForSearch.slice(0, 50));
      return;
    }

    // Debounced search inside modal
    const cleanup = performSearch(modalSearchQuery);
    return cleanup;
  }, [modalSearchQuery, allStocksForSearch, showAddStockModal]);

  const performSearch = (queryStr) => {
      const query = queryStr.toUpperCase();
      const localMatches = allStocksForSearch.filter(s => s.symbol.includes(query)).slice(0, 20);
      
      const runSearch = async () => {
          setLoading(l => ({...l, stocks: true}));
          setSearchPage(1);
          setHasMore(false);
          
          let fnoMatches = [];
          if (/\d/.test(query) || /CE|PE|CALL|PUT/i.test(query) || /NIFTY|BANK/i.test(query)) {
               try {
                  const res = await fastAuthApi(`${API_BASE_URL}/nse_data/fno/search?query=${encodeURIComponent(query)}&page=1&limit=20`);
                  if (res.results) {
                      setHasMore(res.results.length === 20 && res.total > 20);
                      fnoMatches = res.results.map(i => ({
                          ...i,
                          symbol: i.identifier,
                          lastPrice: i.ltp,
                          pChange: i.pChange,
                          isFno: true,
                      }));
                  }
               } catch (e) {
                   console.error("F&O Search failed", e);
               }
          }
          
          const combined = fnoMatches.length > 0 ? [...fnoMatches, ...localMatches] : localMatches;
          setFilteredStocks(combined);
          setLoading(l => ({...l, stocks: false}));
      };
      
      const timer = setTimeout(runSearch, 300);
      return () => clearTimeout(timer);
  };

  // Search handler for autocomplete component
  const handleSearch = async (query) => {
    const upperQuery = query.toUpperCase();
    
    // Search F&O API for autocomplete
    // Note: API returns metadata only, not live prices (ltp is always 0)
    try {
      const res = await fastAuthApi(`${API_BASE_URL}/nse_data/fno/search?query=${encodeURIComponent(upperQuery)}&page=1&limit=20`);
      
      if (res.results && res.results.length > 0) {
        const results = res.results.map(i => ({
          ...i,
          symbol: i.identifier,
          display: i.display || i.identifier,
          lastPrice: i.ltp || 0,
          pChange: i.pChange || 0,
          strike: i.strike,
          expiry: i.expiry,
          type: i.type,
          isFno: true,
        }));
        
        // Remove duplicates
        const seen = new Set();
        const uniqueResults = results.filter(item => {
          if (seen.has(item.symbol)) return false;
          seen.add(item.symbol);
          return true;
        });
        
        return uniqueResults.slice(0, 15);
      }
    } catch (e) {
      console.error("Autocomplete search failed", e);
    }
    
    return [];
  };

  // --- TRADING LOGIC ---

  const handleTrade = async (side, tradeForm) => {
    if (!selectedStock) return;
    if (!tradeForm.quantity || tradeForm.quantity <= 0) return showToast('Enter valid quantity', 'error');
    if (!tradeForm.price || parseFloat(tradeForm.price) <= 0) return showToast('Enter valid price', 'error');

    setLoading(l => ({ ...l, trade: true }));
    showLoading(`Executing ${side} order...`);

    try {
      if (tradeForm.broker === 'fyers') {
         // Fyers Logic
         const payload = {
          symbol: `NSE:${selectedStock.symbol}-EQ`, // Basic assumption, might need adjusting for F&O
          qty: parseInt(tradeForm.quantity),
          type: tradeForm.orderType === 'market' ? 2 : 1,
          side: side === 'BUY' ? 1 : -1,
          productType: 'CNC', // Defaulting to Delivery for now
          limitPrice: tradeForm.orderType === 'limit' ? parseFloat(tradeForm.price) : 0,
          stopPrice: 0,
          validity: 'DAY',
          offlineOrder: false,
         };
         // If it's F&O, symbol format changes. Using a simple heuristic or checking stock.isFno
         if (selectedStock.isFno) {
             payload.symbol = selectedStock.symbol || selectedStock.identifier; // Assuming API expects this format
             payload.productType = 'MARGIN'; 
         }

         const res = await authApi(`${API_BASE_URL}/fyers/order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
         });

         if (res && res.s === 'ok') {
          showToast(`Live ${side} Order Placed: ${res.id}`, 'success');
         } else {
          showToast(`Fyers Error: ${res?.message || 'Order failed'}`, 'error');
         }
      } else {
         // Virtual Logic
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
         
         if (res.wallet_balance !== undefined) setWalletBalance(res.wallet_balance);
         // Enrich holdings with Fyers live prices before setting portfolio
         const enriched = await enrichWithFyersPrices(res.holdings || []);
         setPortfolio(enriched);
         showToast(`${side} ${tradeForm.quantity} ${selectedStock.symbol} Success`, 'success');
      }
      setTimeout(() => setSelectedStock(null), 500); // Close modal
    } catch (err) {
      showToast(err.message || 'Trade failed', 'error');
    } finally {
      setLoading(l => ({ ...l, trade: false }));
      hideLoading();
    }
  };

  const handleSelectStock = async (stock) => {
    setSelectedStock(stock);
    if (!stock.lastPrice || stock.lastPrice === 0) {
      try {
        const symbol = stock.identifier || stock.symbol;
        const priceRes = await fastAuthApi(
          `${API_BASE_URL}/fyers/market/quotes?symbols=${encodeURIComponent(symbol)}`
        );
        if (priceRes?.quotes && priceRes.fyers_connected) {
          const quote = priceRes.quotes[symbol];
          if (quote) {
            setSelectedStock(prev => prev && prev.symbol === stock.symbol
              ? { ...prev, lastPrice: quote.lastPrice, pChange: quote.pChange, change: quote.change }
              : prev
            );
          }
        }
      } catch (e) {
        // Silent fail
      }
    }
  };

  // --- RENDER ---

  const handleWatchlistSwitch = useCallback((wl) => {
    setActiveWatchlist(wl);
    // Show cached data immediately if available
    if (watchlistCache.current[wl.id]) {
      setWatchlistStocks(watchlistCache.current[wl.id]);
    }
    // Fetch fresh data in background (or as primary if no cache)
    fetchWatchlistStocks(wl.id);
  }, []);

  return (
    <div className="virtual-trading">
      {/* Toast */}
      {toast.show && <div className={`virtual-toast ${toast.type}`}>{toast.message}</div>}

      {/* Tabs */}
      <div className="section-tabs" style={{marginBottom: '1rem', display: 'flex', gap: '8px', borderBottom: `1px solid ${isLive ? '#5c4a1e' : '#444c56'}`, paddingBottom: '8px', overflowX: 'auto', alignItems: 'center'}}>
         <span className={`mode-badge ${isLive ? 'mode-badge-live' : 'mode-badge-sandbox'}`}>
           {isLive ? 'LIVE' : 'SANDBOX'}
         </span>
         {['stocks', 'portfolio', 'orders', 'fno', ...(isLive ? [] : ['wallet'])].map(tab => (
           <button
             key={tab}
             className={`virtual-tab ${activeTab === tab ? 'active' : ''} ${isLive ? 'live-mode-tab' : ''}`}
             onClick={() => setActiveTab(tab)}
           >
             {tab === 'stocks' ? 'Trade' : tab === 'fno' ? 'Option Chain' : tab.charAt(0).toUpperCase() + tab.slice(1)}
           </button>
         ))}
      </div>

      {/* Content */}
      {activeTab === 'stocks' && (
        <div className="virtual-stocks-container">
          <MarketStatus />
          {!fyersConnected && !loading.stocks && watchlistStocks.length > 0 && (
            <div style={{
              padding: '8px 12px',
              background: '#2d1f00',
              border: '1px solid #5c4a1e',
              borderRadius: '6px',
              color: '#ffb347',
              fontSize: '0.8rem',
              marginBottom: '8px'
            }}>
              Fyers not connected — prices may be unavailable
            </div>
          )}
          <MarketView
            stocks={watchlistStocks}
            loading={loading.stocks && watchlistStocks.length === 0}
            searchQuery=""
            setSearchQuery={() => {}}
            watchlists={watchlists}
            activeWatchlist={activeWatchlist}
            setActiveWatchlist={handleWatchlistSwitch}
            onCreateWatchlist={createWatchlist}
            onDeleteWatchlist={deleteWatchlist}
            onRemoveStock={removeStockFromWatchlist}
            onShowAddStock={() => { setModalSearchQuery(''); setShowAddStockModal(true); }}
            onSelectStock={handleSelectStock}
            onOpenChart={() => setIsChartOpen(true)}
            onSearch={handleSearch}
            hasMore={false} // Watchlist view doesn't have infinite scroll usually, unless in Add mode (handled by Add Modal)
          />
        </div>
      )}

      {activeTab === 'portfolio' && (
        <div className="portfolio-section">
            <div className="portfolio-header">
                <div>
                  <h2>Portfolio</h2>
                   <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <button className={`virtual-tab mini ${!showFyersPortfolio ? 'active' : ''}`} onClick={() => setShowFyersPortfolio(false)}>Virtual</button>
                    {fyersConnected && <button className={`virtual-tab mini ${showFyersPortfolio ? 'active' : ''}`} onClick={() => { setShowFyersPortfolio(true); fetchFyersData(); }}>Fyers Real</button>}
                  </div>
                </div>
                <button className="ghost-btn" onClick={() => showFyersPortfolio ? fetchFyersData() : fetchPortfolio()}>Refresh</button>
            </div>
            
            <PortfolioView 
              portfolio={showFyersPortfolio ? fyersHoldings.map(h => ({
                  symbol: h.symbol, 
                  quantity: h.quantity, 
                  average_price: h.costPrice, 
                  ltp: h.lp
              })) : portfolio}
              loading={loading.portfolio || loading.fyers}
              onSelectHolding={(h) => {
                   // Convert holding to stock format for TradeModal
                   const stock = {
                       symbol: h.symbol,
                       lastPrice: h.ltp || h.average_price,
                       pChange: 0, 
                       quantity: h.quantity // Pass held quantity
                   };
                   setSelectedStock(stock);
              }}
            />
        </div>
      )}

      {activeTab === 'orders' && (
        <div className="portfolio-section">
             <div className="portfolio-header">
                <h2>Order History</h2>
                <button className="ghost-btn" onClick={fetchOrders}>Refresh</button>
             </div>
             <OrdersView orders={orders} loading={loading.orders} />
        </div>
      )}

      {activeTab === 'fno' && (
        <OptionChain
          symbol="NIFTY"
          onClose={() => setActiveTab('stocks')}
          onSelectToken={(token) => {
              // Build user-friendly display name
              const expShort = token.expiry ? token.expiry.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, d) => {
                const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                return `${parseInt(d)} ${months[parseInt(m)-1]}`;
              }) : '';
              const displayName = `${token.symbol} ${token.strike} ${token.type}${expShort ? ` (${expShort})` : ''}`;

              // Lot sizes for common F&O symbols
              const lotSizes = { NIFTY: 75, BANKNIFTY: 15, FINNIFTY: 25, MIDCPNIFTY: 50 };
              const lotSize = lotSizes[token.symbol] || 1;

              const stockObj = {
                  symbol: token.identifier || `NSE:${token.symbol}${token.expiry?.replace(/-/g,'')}${token.strike}${token.type}`,
                  displayName,
                  lastPrice: token.ltp || 0,
                  pChange: token.pChange || 0,
                  quantity: lotSize,
                  isFno: true
              };
              handleSelectStock(stockObj);
          }}
        />
      )}

      {activeTab === 'wallet' && (
        <div className="wallet-container" style={{height: '100%', display: 'flex', flexDirection: 'column'}}>
           <div className="wallet-nav" style={{display: 'flex', gap: '1rem', padding: '0.5rem 0', marginBottom: '1rem'}}>
              {['balance', 'funds', 'transactions'].map(sub => (
                 <button 
                  key={sub}
                  className={`secondary-btn ${walletSubSection === sub ? 'active-sub' : ''}`}
                  style={{borderColor: walletSubSection === sub ? '#00d09c' : '#444c56'}}
                  onClick={() => setWalletSubSection(sub)}
                 >{sub.charAt(0).toUpperCase() + sub.slice(1)}</button>
              ))}
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

      {/* MODALS */}
      
      {/* Trade Modal */}
      <TradeModal
        isOpen={!!selectedStock && !showAddStockModal && !isChartOpen} // Only show if not adding stock or charting
        onClose={() => setSelectedStock(null)}
        stock={selectedStock}
        walletBalance={walletBalance}
        onTrade={handleTrade}
        isSubmitting={loading.trade}
        mode={mode}
      />

      {/* Chart Modal */}
      {isChartOpen && selectedStock && (
        <ChartModal 
           isOpen={isChartOpen}
           onClose={() => setIsChartOpen(false)}
           stock={selectedStock}
           API_BASE_URL={API_BASE_URL}
        />
      )}

      {/* Add Stock Modal - reusing MarketView in a Modal wrapper or just re-rendering MarketView special logic? 
          For simplicity, I'll render the MarketView component inside a modal wrapper here, passing special props.
      */}
      {showAddStockModal && (
          <div className="stock-trade-modal" onClick={() => { setShowAddStockModal(false); setModalSearchQuery(''); setFilteredStocks([]); }}>
              <div className="stock-trade-shell" onClick={(e) => e.stopPropagation()} style={{maxWidth: '800px', width: '90%', height: '80vh', display: 'flex', flexDirection: 'column'}}>
                  <div className="stock-trade-header">
                      <h3>Add Stock to {activeWatchlist?.name}</h3>
                      <button className="icon-button" onClick={() => { setShowAddStockModal(false); setModalSearchQuery(''); setFilteredStocks([]); }}>×</button>
                  </div>
                  <div className="stock-trade-content" style={{overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1}}>
                       <div className="search-row">
                           <input type="text" placeholder="Search NSE stocks..." value={modalSearchQuery} onChange={e => setModalSearchQuery(e.target.value)} className="search-input" autoFocus />
                       </div>
                       <div className="add-stock-list" style={{overflowY: 'auto', flex: 1, paddingRight: '4px'}}>
                           {filteredStocks.length === 0 ? <div className="loading">No stocks found</div> : 
                             filteredStocks.map((stock, index) => {
                                 const added = watchlistStocks.some(s => s.symbol.toUpperCase() === (stock.identifier || stock.symbol).toUpperCase());
                                 return (
                                     <div key={stock.identifier || stock.symbol || index} className={`add-stock-item ${added ? 'disabled' : ''}`} onClick={() => !added && addStockToWatchlist(stock.symbol)}>
                                         <div className="stock-info">
                                             <span className="stock-symbol">{stock.display || stock.symbol}</span>
                                             <span className="stock-price">₹{Number(stock.lastPrice||0).toFixed(2)}</span>
                                         </div>
                                         {added ? <span className="added-badge">✓ Added</span> : <button className="add-btn-small">+ Add</button>}
                                     </div>
                                 );
                             })
                           }
                           {hasMore && <button className="load-more-btn" onClick={handleLoadMore}>{loading.stocks ? 'Loading' : 'Load More'}</button>}
                       </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default VirtualTrading;
