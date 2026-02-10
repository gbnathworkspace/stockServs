# Outcome: Fix Backend Option Chain

## Status: done

## Changes Made

### 1. `services/option_clock_service.py`
- **Spot price fallback** (line 210): Changed `spot_data.get("lp", 0)` to chain fallbacks: `lp -> prev_close_price -> close_price`. This prevents returning None when market is closed and lp=0.
- **`get_upcoming_expiries()` method** (line 138-155): New helper that returns the next N Thursday expiry dates, skipping current Thursday if after 3 PM.
- **`upcoming_expiries` in return dict** (line 272-278): `fetch_option_chain` now includes `upcoming_expiries` list in its return value.
- **`call_identifier` / `put_identifier`** (line 327-328, 341, 352): Each strike in `strike_breakdown` now includes the Fyers option symbol (e.g., `NSE:NIFTY2621223000CE`) for both CE and PE sides.

### 2. `routes/fyers_market.py`
- **NSE fallback** (line 419-434): When Fyers returns None, falls back to NSE option chain by calling `fetch_nse_data` + `format_option_chain` directly from `nse_data/fno.py`. Returns result with `source: "nse_fallback"`.
- **`expiryDates` in response** (line 446): Route response now includes `expiryDates` array with ISO-formatted upcoming expiry dates.

## What Went Well
- All four sub-tasks were straightforward edits
- Using `fetch_nse_data` + `format_option_chain` directly (instead of calling the route handler) avoids FastAPI Query parameter injection issues

## Risks Noted
- NSE API can be flaky (rate limiting, cookie requirements) -- but it's a fallback, so the worst case is still the same error
