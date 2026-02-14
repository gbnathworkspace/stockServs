# Task 011: Portfolio/Orders Sync & P&L Fix

## Type
bugfix

## Status
in-progress

## Problem Statement
Portfolio tab shows 3 symbols but Orders tab shows only 1 (ABB). This means 2 holdings exist in `virtual_holdings` without corresponding records in `virtual_orders`. Additionally, P&L displays incorrectly when LTP (Last Traded Price) is unavailable — it falls back to average_price making P&L appear as 0 instead of showing "N/A".

## Root Cause Analysis
1. **Missing orders**: Some holdings were created without matching order records (likely from an earlier code version or direct DB operations)
2. **P&L fallback**: `item.ltp || item.average_price` causes P&L=0 when LTP is null/0 instead of indicating "no price data"

## Acceptance Criteria
- [x] All portfolio holdings have at least one corresponding BUY order in order history
- [x] Orders tab shows all symbols that exist in portfolio
- [x] P&L shows correctly when LTP is available
- [x] P&L shows "N/A" or "-" when LTP is unavailable (not misleading 0)
- [x] Consistent number formatting across portfolio and orders views

## Implementation Steps
1. Add `sync_missing_orders()` function in `portfolio_service.py`
2. Call sync from `get_order_history()` to ensure consistency
3. Fix P&L calculation in `PortfolioView.jsx` to handle null LTP
4. Fix summary cards to handle null LTP
5. Test

## Files to Touch
- `services/portfolio_service.py` — add sync function
- `frontend/src/components/trading/PortfolioView.jsx` — fix P&L display

## Risks & Edge Cases
- Sync creates retroactive orders with current average_price (not original trade price)
- Multiple BUY trades for same symbol — sync only creates one order per holding

## Rollback Strategy
- Revert the two file changes
- Retroactive orders are harmless audit records
