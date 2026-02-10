# Task 004: Fix Entire Watchlist Module

- **Type**: bugfix
- **Status**: in-progress
- **Problem Statement**: Watchlist CRUD operations (show, edit, update, insert) are faulty from the UI perspective

## Root Cause Analysis

### Critical Bugs:

**Bug A: fetchWatchlists doesn't re-select activeWatchlist properly**
- `fetchWatchlists()` (line 232) only sets activeWatchlist when `!activeWatchlist` is true
- After `createWatchlist` calls `fetchWatchlists()`, new watchlist is NOT auto-selected
- After `deleteWatchlist` sets a fallback then calls `fetchWatchlists()`, the freshly set activeWatchlist may not match the new list
- Fix: Make `fetchWatchlists` accept an optional `selectId` parameter, or handle auto-select differently

**Bug B: deleteWatchlist race condition**
- Sets `activeWatchlist` to `remaining[0]`, then calls `fetchWatchlists()` asynchronously
- If `fetchWatchlists` overwrites `watchlists` state while `activeWatchlist` still points to old data, UI becomes inconsistent
- Fix: Don't call `fetchWatchlists()` separately — update state directly or await it with proper selection

**Bug C: handleLoadMore spread operator bug (same as prior fix)**
- Line 381-386: `...i` at end overwrites `symbol: i.identifier` with `i.symbol` (underlying)
- Same bug that was fixed in `performSearch` — missed in `handleLoadMore`

**Bug D: removeStockFromWatchlist URL encoding for F&O symbols**
- Symbol "NSE:NIFTY2621225000CE" in URL path needs encoding
- `authApi(.../stocks/${symbol})` doesn't encode the symbol
- Colon and other special chars may cause routing issues

**Bug E: Duplicate stock detection in Add Modal is case-sensitive and format-inconsistent**
- `watchlistStocks.some(s => s.symbol === stock.symbol)` is case-sensitive
- Symbol formats differ between search results and stored watchlist symbols

**Bug F: No loading states for create/delete operations**
- Users can double-click create/delete with no visual feedback

## Implementation Steps

### Task 1: Rewrite fetchWatchlists with proper activeWatchlist management
- Accept optional `selectWatchlistId` parameter
- If `selectWatchlistId` provided, select that watchlist
- If current `activeWatchlist` exists in the new list, keep it
- If current `activeWatchlist` doesn't exist, fall back to first

### Task 2: Fix createWatchlist to auto-select new watchlist
- Use the returned watchlist `id` from the POST response
- Pass it to `fetchWatchlists(selectId)` or set directly

### Task 3: Fix deleteWatchlist to properly handle state
- Remove the separate `fetchWatchlists()` call
- Update `watchlists` state directly (optimistic) or await with proper selection
- Properly fall back to default or first remaining watchlist

### Task 4: Fix handleLoadMore spread operator
- Move `...i` to beginning, same pattern as performSearch fix

### Task 5: Fix removeStockFromWatchlist URL encoding
- Use `encodeURIComponent(symbol)` in the DELETE URL path

### Task 6: Fix duplicate detection and add loading states
- Case-insensitive duplicate check in Add Modal
- Add loading guards for create/delete

## Files to Touch
- `frontend/src/components/VirtualTrading.jsx` — All frontend fixes
- `routes/watchlist.py` — Backend symbol path decoding if needed
