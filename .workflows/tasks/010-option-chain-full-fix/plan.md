# Task 010: Fix Option Chain — Speed, Live Data, Buy/Sell, P&L

- **Type**: bugfix + feature
- **Status**: in-progress
- **Problem Statement**: Option chain is slow, doesn't auto-refresh, buy/sell from chain fails for virtual trades, and P&L tracking doesn't work for F&O positions

## Root Cause Analysis

### Bug A: No auto-refresh for option chain (CRITICAL)
**File**: `frontend/src/components/OptionChain.jsx` lines 112-114
- Only fetches on symbol/expiry change — shows stale data entire session
- No polling mechanism like watchlist has

### Bug B: Virtual F&O trades fail — yfinance can't look up option symbols (CRITICAL)
**File**: `services/portfolio_service.py` lines 47-71
- `_fetch_ltp("NSE:NIFTY2621225000CE")` → tries `NIFTY2621225000CE.NS` on yfinance → fails
- Trade still executes but with wrong LTP, wrong P&L

### Bug C: Portfolio symbol display shows raw F&O identifier (HIGH)
**File**: `frontend/src/components/trading/PortfolioView.jsx` line 60
- Shows `NSE:NIFTY2621225000CE` instead of `NIFTY 25000 CE (12 Feb)`
- No way to distinguish equity vs option positions

### Bug D: VirtualHolding symbol column too small for F&O (MEDIUM)
**File**: `database/models.py` line 73
- `symbol = Column(String(50))` — F&O symbols like `NSE:NIFTY2621225000CE` = 24 chars, fits but tight
- VirtualOrder same issue at line 87

### Bug E: TradeModal doesn't show F&O-specific info (MEDIUM)
**File**: `frontend/src/components/trading/TradeModal.jsx`
- No lot size display, no strike/expiry info, no "F&O" badge

## Implementation Steps

### Task 1 (Frontend): Add auto-refresh to OptionChain
- Add 15-second polling with `setInterval` during market hours
- Add refresh button for manual refresh
- Show "last updated" timestamp
- Pause refresh when market is closed

### Task 2 (Backend): Fix portfolio_service to handle F&O symbols
- Detect F&O symbols (contain "CE" or "PE" suffix, or start with "NSE:")
- For F&O: skip yfinance, use provided trade price as LTP
- For F&O: use Fyers quotes API for live price when available

### Task 3 (Frontend): Fix TradeModal for F&O display
- Show lot size, strike, expiry, type badge when F&O
- Show F&O-specific info in trade summary

### Task 4 (Frontend): Fix PortfolioView for F&O positions
- Parse F&O symbols into human-readable display
- Show "F&O" tag for option positions
- P&L calculation works (qty × price math is correct)

## Files to Touch
- `frontend/src/components/OptionChain.jsx` — Auto-refresh
- `services/portfolio_service.py` — F&O symbol handling
- `frontend/src/components/trading/TradeModal.jsx` — F&O display
- `frontend/src/components/trading/PortfolioView.jsx` — F&O position display
