# Outcome: Portfolio/Orders Sync & P&L Fix

## What was done

### Backend (`services/portfolio_service.py`)
- Added `_sync_missing_orders()` function that detects holdings without matching order records and creates retroactive BUY orders
- Called automatically when order history is fetched via `get_order_history()`
- This ensures the Orders tab always shows all symbols that exist in the Portfolio

### Frontend (`frontend/src/components/trading/PortfolioView.jsx`)
- Fixed P&L calculation to properly handle null/zero LTP (Last Traded Price)
- When LTP is unavailable: Current Value, P&L, and P&L% now show "-" instead of misleading ₹0
- Summary cards show "—" for Current Value and Total P&L when not all prices are available
- Added consistent decimal formatting (2 decimal places) across all monetary values
- Summary card color coding only applies when prices are available

## Result
- Portfolio and Orders tabs now show consistent symbols
- P&L displays correctly with proper formatting
- No misleading ₹0 P&L when market prices aren't available
