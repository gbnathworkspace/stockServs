# Fix Backend Option Chain

- **Type**: bugfix
- **Status**: in-progress
- **Problem Statement**: Option Chain tab shows "Failed to fetch option chain for NIFTY" because `fetch_option_chain` returns None when market is closed (spot price lp=0 after hours).

## Root Cause Analysis
- `spot_price = spot_data.get("lp", 0)` returns 0 after market hours
- The check `if spot_price == 0: return None` kills the entire response
- No fallback to `prev_close_price` or `close_price`
- No NSE fallback when Fyers fails

## Acceptance Criteria
- [x] Spot price falls back to prev_close_price/close_price when lp=0
- [x] NSE option chain fallback when Fyers returns None
- [x] Return upcoming expiry dates list (next 4-5 Thursdays)
- [x] Include Fyers option symbol identifiers in strike data

## Implementation Steps
1. Fix spot price fallback in option_clock_service.py (line 210-215)
2. Add `get_upcoming_expiries()` helper method
3. Include upcoming_expiries in fetch_option_chain return dict
4. Add call_identifier/put_identifier to strike breakdown
5. Add NSE fallback import + logic in fyers_market.py route
6. Include expiryDates in route response

## Files to Touch
- `services/option_clock_service.py` - spot price fallback, expiry helper, identifiers
- `routes/fyers_market.py` - NSE fallback, expiry dates in response

## Risks & Edge Cases
- NSE API might also be unavailable (rate limiting, cookies)
- prev_close_price might also be 0 for newly listed instruments
- Holiday Thursdays (exchange holidays skip those dates)

## Rollback Strategy
- Revert the two files to previous commit state
