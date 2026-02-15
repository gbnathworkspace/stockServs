# Task 003: Fix Prices Not Showing in Market Sandbox

- **Type**: bugfix
- **Status**: in-progress
- **Problem Statement**: Prices are not showing in the market sandbox (VirtualTrading). Stocks display ₹0.00 with no user feedback about why.

## Root Cause Analysis

### Bug 1: `fyersConnected` state never updated during price fetching
**File**: `frontend/src/components/VirtualTrading.jsx`
- `fyersConnected` is initialized to `false` (line 71)
- Only updated in `fetchFyersData()` (line 203) which is called from Portfolio tab
- `fetchWatchlistStocks` and `refreshStocksSilent` both receive `fyers_connected` from the API but never call `setFyersConnected`
- Result: App never knows if Fyers is connected during normal Trade tab usage

### Bug 2: No user feedback when prices fail to load
**File**: `frontend/src/components/VirtualTrading.jsx:259-261`
- Price fetch failure in `fetchWatchlistStocks` only logs to console
- `refreshStocksSilent` also silently fails (line 138-140)
- User sees ₹0.00 with zero explanation

### Bug 3: Stock selected from SearchAutocomplete has no live price
**File**: `frontend/src/components/VirtualTrading.jsx:448-483`
- `handleSearch` returns `lastPrice: i.ltp || 0` which is always 0
- The comment on line 452 confirms: "API returns metadata only, not live prices (ltp is always 0)"
- When user selects a stock, no price fetch is triggered
- TradeModal opens with ₹0.00 price

### Bug 4: No connection status shown in Trade tab
**File**: `frontend/src/components/VirtualTrading.jsx:579-599`
- Trade tab renders MarketView with watchlistStocks but no connection banner
- Unlike Portfolio tab which checks `fyersConnected` (line 609)

## Acceptance Criteria
- [ ] `fyersConnected` state updated from every price fetch response
- [ ] Fyers connection status checked on initial load
- [ ] Banner shown in Trade tab when Fyers is disconnected
- [ ] Toast shown when initial price fetch fails
- [ ] Stock price fetched immediately when selected from search autocomplete
- [ ] Prices display correctly when Fyers token is valid

## Implementation Steps

### Frontend (VirtualTrading.jsx)
1. Call `/fyers/status` on initial mount to set `fyersConnected`
2. Update `fyersConnected` from `fyers_connected` field in price fetch responses (fetchWatchlistStocks, refreshStocksSilent)
3. Show "Connect Fyers for live prices" banner when `!fyersConnected` in Trade tab
4. Fetch live price on stock selection from search (`onSelectStock` should trigger a quote fetch)
5. Show toast when initial price fetch fails

### Backend (routes/fyers_market.py)
6. Return `fyers_connected: false` vs `fyers_connected: true` + `quotes_error: true` to differentiate "no token" from "API failed"

## Files to Touch
- `frontend/src/components/VirtualTrading.jsx` - Main fixes
- `frontend/src/components/trading/MarketView.jsx` - Connection status banner
- `routes/fyers_market.py` - Better error differentiation

## Risks & Edge Cases
- Don't show connection banner during initial loading state
- Handle race condition between status check and price fetch
- Don't spam toasts on every refresh failure (only on initial load)
