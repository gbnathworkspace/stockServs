# Option Chain Tab Fix - Market Sandbox

- **Type:** bugfix
- **Status:** in-progress
- **Problem Statement:** The Option Chain tab in Market Sandbox shows only OI data. LTP, Volume, and Change% columns are empty because the backend doesn't include these fields in `strike_breakdown`. Additionally, only NIFTY/BANKNIFTY are supported server-side while the frontend offers 7 symbols.

## Root Cause Analysis

1. **Missing price data in strike_breakdown**: `_process_option_data()` in `option_clock_service.py` only extracts `open_interest` and `oi_change` from Fyers quotes. Fyers returns `lp` (LTP), `volume`, `ch` (change), `chp` (change%) but these are ignored.
2. **Limited symbol support**: `SUPPORTED_INDICES` only has NIFTY and BANKNIFTY. Frontend offers FINNIFTY, RELIANCE, HDFCBANK, INFY, TCS which all return `None`.
3. **Frontend field mismatch**: Frontend expects `call_ltp`, `call_volume`, `call_change`, `call_pChange` in strike data but backend only sends `call_oi`, `put_oi`, `call_oi_change`, `put_oi_change`.

## Acceptance Criteria

- [x] Option chain table shows LTP, Volume, Change% for both calls and puts
- [x] All 7 symbols (NIFTY, BANKNIFTY, FINNIFTY, RELIANCE, HDFCBANK, INFY, TCS) work
- [x] Spot price displays correctly
- [x] PCR displays correctly
- [x] Buy/Sell buttons still trigger trade modal

## Implementation Steps

1. Update `SUPPORTED_INDICES` in `option_clock_service.py` to add FINNIFTY + stock symbols
2. Add step sizes for each symbol (NIFTY=50, BANKNIFTY=100, stocks vary)
3. Update `_process_option_data()` to extract LTP, volume, change, pChange from Fyers quote data
4. Ensure frontend field names match backend response

## Files to Touch

- `services/option_clock_service.py` — Add symbols, enrich strike_breakdown with price data
- `frontend/src/components/OptionChain.jsx` — Minor: ensure field mapping matches

## Risks & Edge Cases

- Fyers symbol format for stock options differs from index options
- Stocks have different lot sizes and strike intervals
- If Fyers API quota is hit, batch sizes need to stay within 50 symbols per call

## Rollback Strategy

- Revert changes to `option_clock_service.py` and `OptionChain.jsx`
