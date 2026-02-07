import React, { useState, useEffect } from 'react';
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

const VirtualTrading = ({ initialTab = 'trade' }) => {
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
  }, []);

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
        setWatchlistStocks(updatedStocks);
      }
    } catch (err) {
      console.error('Failed to refresh watchlist stocks', err);
    }
  };

  const showToast = (message, type = 'info') => {
    setToast({ message, type, show: true });
    setTimeout(() => setToast({ message: '', type: '', show: false }), 3000);
  };

  const fetchPortfolio = async () => {
    setLoading((l) => ({ ...l, portfolio: true }));
    try {
      const res = await authApi(`${API_BASE_URL}/portfolio/summary`);
      setPortfolio(res.holdings || []);
      setWalletBalance(res.wallet_balance || 100000);
    } catch (err) {
      console.error('Failed to load portfolio', err);
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
  
  const fetchWatchlists = async () => {
    setLoading(l => ({ ...l, watchlists: true }));
    try {
      const res = await authApi(`${API_BASE_URL}/watchlist`);
      const lists = res.watchlists || [];
      setWatchlists(lists);

      // Auto-select first watchlist if none selected
      // (Backend auto-creates a default watchlist if none exist)
      if (lists.length > 0 && !activeWatchlist) {
        setActiveWatchlist(lists[0]);
        fetchWatchlistStocks(lists[0].id);
      }
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
      setWatchlistStocks(stocks);

      // Fetch live prices immediately (works even outside market hours)
      if (stocks.length > 0) {
        try {
          const symbols = stocks.map(s => s.symbol).slice(0, 50).join(',');
          const priceRes = await fastAuthApi(`${API_BASE_URL}/fyers/market/quotes?symbols=${encodeURIComponent(symbols)}`);
          if (priceRes?.quotes && priceRes.fyers_connected) {
            const withPrices = stocks.map(stock => {
              const quote = priceRes.quotes[stock.symbol];
              return quote ? { ...stock, lastPrice: quote.lastPrice, pChange: quote.pChange, change: quote.change, high: quote.high, low: quote.low, volume: quote.volume } : stock;
            });
            setWatchlistStocks(withPrices);
          }
        } catch (priceErr) {
          console.error('Failed to fetch initial prices', priceErr);
        }
      }
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
    const name = `Watchlist ${watchlists.length + 1}`;
    try {
      await authApi(`${API_BASE_URL}/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, position: watchlists.length }),
      });
      showToast(`Created ${name}`, 'success');
      fetchWatchlists();
    } catch (err) {
       showToast('Failed to create watchlist', 'error');
    }
  };

  const deleteWatchlist = async (watchlistId) => {
    const watchlistToDelete = watchlists.find(w => w.id === watchlistId);
    
    if (watchlistToDelete?.is_default) {
      showToast('Cannot delete the default watchlist', 'error');
      return;
    }
    
    try {
      await authApi(`${API_BASE_URL}/watchlist/${watchlistId}`, { method: 'DELETE' });
      showToast('Watchlist deleted', 'success');
      
      // Cleanup
      if (activeWatchlist?.id === watchlistId) {
        const remaining = watchlists.filter(w => w.id !== watchlistId);
        if (remaining.length > 0) {
            setActiveWatchlist(remaining[0]);
            fetchWatchlistStocks(remaining[0].id);
        } else {
            setActiveWatchlist(null);
        }
      }
      fetchWatchlists();
    } catch (err) {
      showToast('Failed to delete', 'error');
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
      await fetchWatchlistStocks(activeWatchlist.id);
      // Don't close modal to allow multiple adds
    } catch (err) {
      showToast('Failed to add stock', 'error');
    }
  };

  const removeStockFromWatchlist = async (symbol) => {
    if (!activeWatchlist) return;
    try {
      await authApi(`${API_BASE_URL}/watchlist/${activeWatchlist.id}/stocks/${symbol}`, { method: 'DELETE' });
      showToast(`Removed ${symbol}`, 'success');
      await fetchWatchlistStocks(activeWatchlist.id);
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
        
        return uniqueResults.slice(0, 8);
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
         
         setPortfolio(res.holdings || []);
         if (res.wallet_balance !== undefined) setWalletBalance(res.wallet_balance);
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

  // --- RENDER ---

  return (
    <div className="virtual-trading">
      {/* Toast */}
      {toast.show && <div className={`virtual-toast ${toast.type}`}>{toast.message}</div>}

      {/* Tabs */}
      <div className="section-tabs" style={{marginBottom: '1rem', display: 'flex', gap: '8px', borderBottom: '1px solid #444c56', paddingBottom: '8px', overflowX: 'auto'}}>
         {['stocks', 'portfolio', 'orders', 'fno', 'wallet'].map(tab => (
           <button 
             key={tab}
             className={`virtual-tab ${activeTab === tab ? 'active' : ''}`}
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
          <MarketView
            stocks={watchlistStocks}
            loading={loading.stocks && watchlistStocks.length === 0}
            searchQuery=""
            setSearchQuery={() => {}}
            watchlists={watchlists}
            activeWatchlist={activeWatchlist}
            setActiveWatchlist={(wl) => { setActiveWatchlist(wl); fetchWatchlistStocks(wl.id); }}
            onCreateWatchlist={createWatchlist}
            onDeleteWatchlist={deleteWatchlist}
            onRemoveStock={removeStockFromWatchlist}
            onShowAddStock={() => { setModalSearchQuery(''); setShowAddStockModal(true); }}
            onSelectStock={setSelectedStock}
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
              const stockObj = {
                  symbol: token.identifier || `${token.symbol} ${token.expiry} ${token.strike} ${token.type}`,
                  lastPrice: token.ltp,
                  pChange: token.pChange,
                  isFno: true
              };
              let qty = token.symbol === 'NIFTY' ? 50 : 15; // Rough heuristic
              setSelectedStock(stockObj);
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
                             filteredStocks.map(stock => {
                                 const added = watchlistStocks.some(s => s.symbol === stock.symbol);
                                 return (
                                     <div key={stock.symbol} className={`add-stock-item ${added ? 'disabled' : ''}`} onClick={() => !added && addStockToWatchlist(stock.symbol)}>
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
