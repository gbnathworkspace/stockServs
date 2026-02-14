# Task: Fix F&O Trading Flow (Search → Buy → Sell → P/L)

- **Type**: bugfix
- **Status**: done

## Problem Statement
The Market Sandbox F&O trading flow is broken end-to-end:
1. Searching for a NIFTY strike price and buying works, but portfolio shows 0 P&L
2. Selling from portfolio uses wrong price (average price instead of market)
3. Orders tab shows empty until manually refreshed

## Root Cause Analysis
1. `convert_nse_to_fyers()` double-prefixes F&O symbols already in Fyers format (`NSE:NIFTY...CE` → `NSE:NSE:NIFTY...CE-EQ`)
2. Backend uses yfinance for LTP which can't resolve Fyers-format F&O symbols → LTP always null
3. Frontend auto-refresh updates watchlist prices but not portfolio prices
4. Orders tab has no auto-fetch on tab switch

## Acceptance Criteria
- [x] F&O symbols pass through `convert_nse_to_fyers` unchanged
- [x] Portfolio shows live LTP for F&O holdings via Fyers quotes
- [x] P&L calculates correctly with live prices
- [x] Sell from portfolio uses current market price
- [x] Auto-refresh updates portfolio prices alongside watchlist
- [x] Orders tab auto-loads on switch

## Files Changed
1. `services/fyers_service.py` - Fix `convert_nse_to_fyers` to detect already-Fyers-format symbols
2. `frontend/src/components/VirtualTrading.jsx` - Add Fyers price enrichment for portfolio, auto-fetch orders
