# Task 007: Fix Frontend Duplicate API Calls

- **Type**: performance
- **Status**: in-progress
- **Problem Statement**: Network logs show massive API call duplication on page load:
  - `/profile/me` called 2x (ThemeContext mount + App.jsx syncThemeWithBackend)
  - `/fyers/status` called 3x (VirtualTrading, RealTrading, Settings - each independently)
  - `/portfolio/summary` called 3x (Dashboard, VirtualTrading, Wallet)
  - `/nse_data/fii-dii-activity` called 2x (Dashboard, FiiDiiActivity)

## Root Cause Analysis
1. **No request deduplication in api.js**: `authApi` has no dedup. Only `fastAuthApi` does, but most callers use `authApi`.
2. **ThemeContext calls `/profile/me` on mount AND App.jsx calls `syncThemeWithBackend()` again** - double call to `/profile/me`.
3. **Multiple components independently fetch `/fyers/status`** - VirtualTrading, RealTrading, and Settings each call it on mount.
4. **No shared state for common data** - portfolio summary, fyers status fetched independently by each component.

## Acceptance Criteria
- [x] GET request deduplication added to core `authApi` function
- [x] `/profile/me` called only once on page load (remove duplicate from App.jsx)
- [x] `/fyers/status` calls deduplicated via the in-flight cache
- [x] `/portfolio/summary` calls deduplicated via the in-flight cache
- [x] No functional regressions - dedup is transparent

## Implementation Steps
1. Add in-flight request deduplication to `authApi` for GET requests
2. Remove duplicate `syncThemeWithBackend()` call from App.jsx (ThemeContext already calls it on mount)
3. Settings.jsx: Remove duplicate useEffect for fyers status (runs on mount AND subSection change)

## Files to Touch
- `frontend/src/lib/api.js` - Add GET dedup to authApi
- `frontend/src/App.jsx` - Remove duplicate syncThemeWithBackend call
- `frontend/src/components/sections/Settings.jsx` - Remove duplicate fyers status check

## Risks & Edge Cases
- POST/PUT/DELETE must NOT be deduplicated
- Dedup cache must clear on completion (success or failure) to allow re-fetching
- Different query params = different URLs = separate requests (correct behavior)

## Rollback Strategy
- Revert the 3 file changes
