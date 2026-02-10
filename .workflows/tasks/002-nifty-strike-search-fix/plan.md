# Task 002: Fix Nifty Strike Prices Not Showing in Search Box

- **Type**: bugfix
- **Status**: in-progress
- **Problem Statement**: All NIFTY strike prices are not showing in the search box in market sandbox (VirtualTrading component)

## Root Cause Analysis

Three bugs identified:

### Bug 1: `performSearch` spread operator overwrites `symbol` (Frontend)
**File**: `frontend/src/components/VirtualTrading.jsx:388-394`
In the Add Stock Modal search, `...i` is placed at the END of the object literal, so `i.symbol` (which is the underlying "NIFTY") overwrites the explicit `symbol: i.identifier` (which is the full option symbol like "NSE:NIFTY2621225000CE"). This causes all NIFTY results to have `symbol: "NIFTY"`, making them appear as duplicates and rendering only one in React due to duplicate keys.

### Bug 2: Backend `all()` text match conflicts with strike tolerance (Backend)
**File**: `nse_data/fno.py:481`
The search has a strike tolerance of ±1000 (line 474), but the `all(p in desc or p in sym_up for p in parts)` check at line 481 requires ALL query parts (including the strike number) to literally appear as a substring in the description or symbol. This means when searching "NIFTY 25000 CE", a 24500 strike passes the tolerance check but FAILS the text check because "25000" is not in "NIFTY 26 Feb 13 24500 CE". The tolerance filter becomes useless.

### Bug 3: Autocomplete limited to 8 results (Frontend)
**File**: `frontend/src/components/VirtualTrading.jsx:440` and `MarketView.jsx:45`
`maxResults={8}` and `uniqueResults.slice(0, 8)` limits visible strike prices to just 8 in the autocomplete dropdown, which is too few for F&O searches where users need to scan multiple strikes.

## Acceptance Criteria
- [ ] Searching "NIFTY" shows multiple different strike prices (not just one)
- [ ] Searching "NIFTY 25000 CE" shows strikes around 25000 (within tolerance)
- [ ] Add Stock Modal shows all matching strikes with correct symbols
- [ ] Selecting a strike price from search correctly identifies the option contract
- [ ] No regression in equity stock search

## Implementation Steps

1. **Fix `performSearch` spread operator** - Move `...i` to the beginning of the object, before explicit properties
2. **Fix backend search** - Skip numeric parts from the `all()` text check when `strike_target` is set (let the tolerance filter handle numeric matching)
3. **Increase autocomplete results for F&O** - Increase from 8 to 15 for F&O searches
4. **Fix Add Stock Modal key** - Use `identifier` or index-based key instead of `symbol`

## Files to Touch
- `frontend/src/components/VirtualTrading.jsx` - Fix spread operator, increase slice limit
- `nse_data/fno.py` - Fix `all()` parts check to skip numeric parts when strike_target exists

## Risks & Edge Cases
- Increasing result count may slow down quote fetching
- Changing text matching could return too many irrelevant results
- Need to maintain backward compatibility for equity search

## Rollback Strategy
- Revert the specific commits on `jackrnd` branch
