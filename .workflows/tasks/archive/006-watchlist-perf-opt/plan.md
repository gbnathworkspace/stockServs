# Task 006 - Watchlist Performance Optimization

- **Type**: performance
- **Status**: in-progress
- **Problem Statement**: Watchlist add/remove triggers full reload + Fyers price fetch causing unnecessary latency. Tab switching also lacks caching, causing re-fetches on every switch.

## Acceptance Criteria
- [x] addStockToWatchlist uses optimistic local state update instead of full reload
- [x] removeStockFromWatchlist uses optimistic local state update instead of full reload
- [x] Watchlist tab switching uses cache for instant display with background refresh
- [x] MarketView watchlist tabs have consistent styling

## Implementation Steps
1. Fix addStockToWatchlist - optimistic add + background price fetch
2. Fix removeStockFromWatchlist - optimistic remove
3. Add watchlistCache ref + integrate into fetchWatchlistStocks and handleWatchlistSwitch
4. Review MarketView.jsx watchlist tab styling for consistency

## Files to Touch
- `frontend/src/components/VirtualTrading.jsx` - perf fixes 1-3
- `frontend/src/components/trading/MarketView.jsx` - styling fix

## Risks & Edge Cases
- Optimistic add could show stale data if POST fails (mitigated by error toast)
- Cache could serve stale data (mitigated by background refresh)

## Rollback Strategy
- Revert to fetchWatchlistStocks calls on add/remove
