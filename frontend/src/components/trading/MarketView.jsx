import React, { useRef, useCallback } from 'react';
import SearchAutocomplete from '../SearchAutocomplete';

export default function MarketView({
  stocks,
  loading,
  onSelectStock,
  onOpenChart,
  searchQuery,
  setSearchQuery,
  watchlists,
  activeWatchlist,
  setActiveWatchlist,
  onCreateWatchlist,
  onDeleteWatchlist,
  onRemoveStock,
  onShowAddStock,
  hasMore,
  onLoadMore,
  onSearch // New prop for search functionality
}) {
  // Intersection Observer for infinite scroll
  const observer = useRef();
  const lastStockElementRef = useCallback(node => {
    if (loading) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        onLoadMore();
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, hasMore, onLoadMore]);

  return (
    <div className="virtual-trading-container">
      {/* Search and Watchlist Header */}
      <div className="market-header">
        <SearchAutocomplete
          placeholder="Search stocks (e.g. RELIANCE, NIFTY 25JAN...)"
          onSelect={onSelectStock}
          fetchSuggestions={onSearch}
          minChars={1}
          debounceMs={300}
          maxResults={8}
        />

        <div className="watchlist-tabs">
          {watchlists.map(w => (
            <div 
              key={w.id} 
              className={`watchlist-tab ${activeWatchlist?.id === w.id ? 'active' : ''}`}
              onClick={() => setActiveWatchlist(w)}
            >
              <span className="watchlist-name">{w.name}</span>
              {activeWatchlist?.id === w.id && !w.is_default && (
                <button 
                  className="delete-watchlist-btn"
                  onClick={(e) => { e.stopPropagation(); onDeleteWatchlist(w.id); }}
                  title="Delete Watchlist"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {watchlists.length < 15 && (
            <button className="new-watchlist-btn" onClick={onCreateWatchlist}>
              +
            </button>
          )}
        </div>

        {activeWatchlist && (
          <div className="watchlist-actions">
            <button className="add-stock-btn" onClick={onShowAddStock}>
              + Add Stock
            </button>
          </div>
        )}
      </div>

      {/* Stocks Grid */}
      <div className="stocks-grid">
        {loading ? (
          <div className="loading-state">Loading stocks...</div>
        ) : stocks.length === 0 ? (
          <div className="empty-state">No stocks found</div>
        ) : (
          stocks.map((stock, index) => {
            const isLast = index === stocks.length - 1;
            return (
              <div 
                key={`${stock.symbol}-${index}`} 
                ref={isLast ? lastStockElementRef : null}
                className="stock-card"
                onClick={() => onSelectStock(stock)}
              >
                <div className="stock-card-header">
                  <div className="stock-info">
                    <span className="stock-symbol">{stock.symbol}</span>
                    <span className={`stock-price ${stock.pChange >= 0 ? 'positive' : 'negative'}`}>
                      ₹{Math.abs(stock.lastPrice || 0).toFixed(2)}
                    </span>
                  </div>
                  <div className="stock-actions">
                    <button 
                      className="chart-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectStock(stock); // Set selected stock first
                        onOpenChart();
                      }}
                    >
                      📊
                    </button>
                    {activeWatchlist && !searchQuery.trim() && (
                      <button 
                        className="remove-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveStock(stock.symbol);
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="stock-card-body">
                  <div className={`change-pill ${stock.pChange >= 0 ? 'positive' : 'negative'}`}>
                    {stock.pChange >= 0 ? '▲' : '▼'} {Math.abs(stock.pChange || 0).toFixed(2)}%
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
