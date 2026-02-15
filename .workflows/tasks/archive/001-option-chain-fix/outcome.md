# Outcome: Option Chain Tab Fix

**Status:** done

## What Changed

### Backend (`services/option_clock_service.py`)
1. **Expanded symbol support** — Added `SUPPORTED_STOCKS` dict (RELIANCE, HDFCBANK, INFY, TCS) alongside existing `SUPPORTED_INDICES` (added FINNIFTY, MIDCPNIFTY)
2. **Added `STRIKE_STEPS` config** — Per-symbol strike interval sizes instead of hardcoded 50/100
3. **Enriched `_process_option_data`** — Now extracts LTP (`lp`), volume, change (`ch`), change% (`chp`) from Fyers quotes and includes them in `strike_breakdown` as `call_ltp`, `call_volume`, `call_change`, `call_pChange` (and same for puts)
4. **Updated `fetch_option_chain`** — Looks up spot symbol from both `SUPPORTED_INDICES` and `SUPPORTED_STOCKS`, uses per-symbol strike steps

### Frontend (`frontend/src/components/OptionChain.jsx`)
1. **Updated symbol list** — Added MIDCPNIFTY to match backend
2. **Fixed null-check for CE/PE** — Changed from `data.call_oi` to `(data.call_oi || data.call_ltp)` so rows with LTP but no OI still show
3. **Added error state** — Clear error messages when Fyers not connected or backend returns errors
4. **Added error display UI** — Red banner for connection/fetch errors

### Frontend (`frontend/src/components/VirtualTrading.jsx`)
1. **Added `fno` and `wallet` to `getInitialTab`** — Allows direct navigation to Option Chain tab

## What Went Well
- Root cause was clear: backend was discarding price data from Fyers quotes
- The data was already available from the API, just not being extracted

## Risks
- Fyers option symbol format (`NSE:NIFTY24D2624000CE`) is fragile and may need adjustment for monthly vs weekly expiries
- Stock option symbol format may differ from index options at Fyers
