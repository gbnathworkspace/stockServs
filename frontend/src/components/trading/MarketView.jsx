import React, { useRef, useCallback } from 'react';
import SearchAutocomplete from '../SearchAutocomplete';

const StockCard = React.memo(({ stock, onSelectStock, onOpenChart, onRemoveStock, activeWatchlist, searchQuery, isLast, lastStockElementRef }) => {
  return (
    <div
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
              onSelectStock(stock);
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
});

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
          maxResults={15}
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
          <div className="empty-state" style={{opacity: 0.9}}>
            <div className="loading-spinner" style={{width: '40px', height: '40px', marginBottom: '1rem'}}></div>
            <div className="empty-state-title">Loading stocks...</div>
            <div className="empty-state-text" style={{color: 'var(--text-secondary)', fontSize: '0.85rem'}}>Fetching watchlist data</div>
          </div>
        ) : stocks.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">No stocks yet</div>
            <div className="empty-state-text">Click "+ Add Stock" to add stocks to this watchlist</div>
          </div>
        ) : (
          stocks.map((stock, index) => (
            <StockCard
              key={stock.symbol}
              stock={stock}
              onSelectStock={onSelectStock}
              onOpenChart={onOpenChart}
              onRemoveStock={onRemoveStock}
              activeWatchlist={activeWatchlist}
              searchQuery={searchQuery}
              isLast={index === stocks.length - 1}
              lastStockElementRef={lastStockElementRef}
            />
          ))
        )}
      </div>
    </div>
  );
}
