# Task 008: Fix TradeModal - Option Chain Buy Flow

- **Type**: bugfix
- **Status**: in-progress
- **Problem Statement**: When clicking Buy/Sell from Option Chain, the TradeModal shows:
  1. Raw Fyers identifier (`NSE:NIFTY2611320450PE`) instead of user-friendly name
  2. Price shows `₹0.00` (LTP is 0 after market hours, no price fetch attempted)
  3. Missing CSS for `.toggle-group`, `.toggle-btn`, `.trade-summary`, `.summary-row`, `.trade-actions` causing broken layout
  4. Lot size not defaulted (calculated but never used)

## Root Cause Analysis
- `onSelectToken` in VirtualTrading.jsx directly calls `setSelectedStock()` instead of `handleSelectStock()` which has price-fetch logic
- No `displayName` field — raw identifier used for display
- modal.css missing styles for trade form elements
- Lot size `qty` variable calculated but never assigned to stockObj

## Acceptance Criteria
- [x] TradeModal shows user-friendly name like "NIFTY 20450 PE (13 Nov)"
- [x] Price auto-fetches via Fyers quotes when LTP is 0
- [x] Lot size defaults to correct value (NIFTY=75, BANKNIFTY=15, etc.)
- [x] All trade form elements properly styled
- [x] Trade submission works for F&O symbols
- [x] Build succeeds

## Implementation Steps
1. VirtualTrading.jsx: Fix onSelectToken - add displayName, use handleSelectStock, pass lot size
2. TradeModal.jsx: Show displayName, show identifier subtitle, handle 0 price
3. modal.css: Add all missing trade form styles
4. Build and verify

## Files to Touch
- `frontend/src/components/VirtualTrading.jsx` - onSelectToken handler
- `frontend/src/components/trading/TradeModal.jsx` - display and UX
- `frontend/src/components/trading/modal.css` - missing styles
