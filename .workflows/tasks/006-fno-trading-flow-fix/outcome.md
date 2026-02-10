# Outcome

## What was done
Fixed 5 bugs in the F&O trading flow:

1. **Backend: `convert_nse_to_fyers` double-prefix bug** - F&O symbols from search API are already in Fyers format (e.g., `NSE:NIFTY2502726000CE`). The conversion function was blindly wrapping them again → `NSE:NSE:NIFTY2502726000CE-EQ`. Fixed by detecting the `NSE:` prefix and returning as-is.

2. **Frontend: Portfolio LTP always null for F&O** - Backend enrichment uses yfinance which can't resolve Fyers F&O symbols. Added `enrichWithFyersPrices()` helper that fetches live quotes from Fyers and merges into portfolio holdings.

3. **Frontend: Sell price wrong** - Since LTP was null, TradeModal pre-filled with average buy price. Now with Fyers enrichment, LTP is correct and sell executes at market price.

4. **Frontend: Auto-refresh skipped portfolio** - `refreshStocksSilent` was already fetching portfolio symbols but only updating `watchlistStocks`. Now also updates `portfolio` state.

5. **Frontend: Orders tab empty on switch** - Added `useEffect` to auto-call `fetchOrders()` when `activeTab === 'orders'`.

## Verification
- Backend: `convert_nse_to_fyers('RELIANCE')` → `NSE:RELIANCE-EQ` (unchanged)
- Backend: `convert_nse_to_fyers('NSE:NIFTY2502726000CE')` → `NSE:NIFTY2502726000CE` (fixed)
- Frontend: `vite build` succeeds
- All imports pass
