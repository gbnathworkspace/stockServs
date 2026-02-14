# Task 002: Fix Frontend OptionChain Component

- **Type:** bugfix
- **Status:** in-progress
- **Branch:** jackrnd

## Problem Statement

The Option Chain tab shows "Failed to fetch option chain for NIFTY" error but the user never sees it because the catch block doesn't call `setError()`. Additionally, the component lacks multiple expiry support, proper identifiers for B/S buttons, market closed indication, and has a blank screen when no data is loaded.

## Root Cause Analysis

1. **Silent error swallowing**: catch block at line 94-96 only logs to console, never calls `setError()`
2. **Single expiry only**: `expiryDates` is constructed from a single `expiryDate` field; backend now returns `expiryDates` array and `upcoming_expiries`
3. **Missing identifiers**: B/S buttons spread `row.CE`/`row.PE` into the token but never set `identifier`, so VirtualTrading.jsx falls back to a constructed string
4. **No market closed state**: When spot data comes from `prev_close`, user has no indication
5. **Blank empty state**: When `chainData` is null and no error, user sees nothing

## Acceptance Criteria

- [x] Error message shown to user when fetch fails
- [x] Expiry dropdown populated with multiple dates from backend
- [x] B/S buttons pass `identifier` field (Fyers symbol) to VirtualTrading
- [x] Yellow banner shown when market is closed (data from prev_close)
- [x] Helpful empty state message when no data and no error
- [x] `ltp` field passed in onSelectToken for trade modal

## Implementation Steps

1. Fix catch block to call `setError()`
2. Update data transformation to extract `call_identifier`/`put_identifier` from strike data
3. Update expiry dates handling to use `expiryDates` array from backend
4. Add `spotSource` state to track if data is from prev_close
5. Add market closed banner UI
6. Add empty state UI
7. Update B/S button onClick to include `identifier` and `ltp`

## Files to Touch

- `frontend/src/components/OptionChain.jsx` - All fixes
- `frontend/src/components/VirtualTrading.jsx` - Already has identifier fallback, verify only

## Risks & Edge Cases

- Backend response format may change - need to verify after Task #1 completes
- `identifier` field may not exist in older cached responses

## Rollback Strategy

- Revert single file: `git checkout HEAD -- frontend/src/components/OptionChain.jsx`
