# Task 009: Fix Option Chain Showing Empty Data (All Dashes)

- **Type**: bugfix
- **Status**: in-progress
- **Problem Statement**: Option chain shows strike prices and spot price correctly but ALL option data (OI, VOL, LTP, CHG%) shows dashes. PCR = 0.

## Root Cause Analysis

### Bug A: CRITICAL — Wrong Fyers field names for OI and volume
**File**: `services/option_clock_service.py` lines 316-321
```python
oi = v.get("open_interest", 0) or 0      # WRONG! Fyers uses "oi"
oi_change = v.get("oi_change", 0) or 0   # WRONG! Fyers doesn't have this field
volume = v.get("volume", 0) or 0          # Possibly wrong — Fyers uses "vol_traded_today"
```
Fyers v3 API `v` object uses:
- `"oi"` for open interest (not `"open_interest"`)
- `"pdoi"` for previous day OI (not `"oi_change"`)
- `"vol_traded_today"` for volume (not `"volume"`)
OI change must be computed as `oi - pdoi`.

### Bug B: CRITICAL — No LTP fallback when market is closed
**File**: `services/option_clock_service.py` line 318
```python
ltp = v.get("lp", 0) or 0  # Returns 0 when market closed!
```
When market is closed, `lp` = 0 for option contracts. The spot price correctly falls back to `prev_close_price` (line 233) but options don't.

### Bug C: HIGH — Silent failure in batch quote requests
**File**: `services/option_clock_service.py` lines 264-267
```python
if batch_response.get("s") == "ok":
    all_option_data.extend(batch_response.get("d", []))
# NO ELSE — failures silently swallowed!
```

### Bug D: HIGH — No validation when all_option_data is empty
**File**: `services/option_clock_service.py` lines 272-279
`_process_option_data()` is called with empty list, returns dict with empty `strike_breakdown`, backend treats it as success — NSE fallback never triggers.

### Bug E: MEDIUM — Frontend CHG% shows bare `%` when CE/PE is null
**File**: `frontend/src/components/OptionChain.jsx` lines 227-228, 235-236
```jsx
{row.CE?.pChange?.toFixed(1)}%  // Shows just "%" when CE is null
```
Should show `-` when null.

### Bug F: MEDIUM — No diagnostic logging
No logging of generated option symbols, batch responses, or empty results. Impossible to diagnose issues.

## Implementation Steps

### Task 1 (Backend): Fix option_clock_service.py
1. Fix field name mappings: `oi`, `pdoi`, `vol_traded_today` with fallbacks
2. Add LTP fallback for market-closed scenario: `lp` → `prev_close_price`
3. Add error logging for failed batch quotes
4. Add logging of generated option symbols (first batch only)
5. Validate `all_option_data` — if empty, return None to trigger NSE fallback
6. Log when `strike_breakdown` is empty after processing

### Task 2 (Frontend): Fix OptionChain.jsx
1. Fix CHG% display to handle null CE/PE gracefully
2. Show warning banner when all data is empty but strikes exist
3. Log diagnostic info for debugging

## Files to Touch
- `services/option_clock_service.py` — Field name fixes, logging, validation
- `frontend/src/components/OptionChain.jsx` — Display fixes

## Risks & Edge Cases
- Field names may vary between Fyers API versions — use fallback chain
- Market closed vs genuinely empty data — differentiate in logging
- Don't break working spot price fetch
