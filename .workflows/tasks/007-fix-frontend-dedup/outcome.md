# Task 007: Outcome

## What was done

### 1. GET Request Deduplication in `authApi` (api.js)
- Added in-flight request cache to `authApi` using the existing `pendingRequests` Map
- When a GET request to the same URL is already pending, the same promise is returned
- POST/PUT/DELETE requests are never deduplicated
- Promise is removed from cache on completion (success or failure) via `.finally()`
- This is the highest-impact fix - it automatically deduplicates ALL concurrent GET requests across the entire app

### 2. Simplified `fastAuthApi` (api.js)
- Removed the separate deduplication layer from `fastAuthApi` since `authApi` now handles it
- This prevents a circular reference issue where both layers used the same `pendingRequests` Map
- `fastAuthApi` now simply wraps `authApi` with silent error handling

### 3. Removed duplicate `/profile/me` call (App.jsx)
- `ThemeContext` already calls `syncThemeWithBackend()` on mount (which fetches `/profile/me`)
- `App.jsx` was calling `syncThemeWithBackend()` again in its own `useEffect`
- Removed the duplicate call, reducing `/profile/me` requests from 2 to 1

### 4. Removed duplicate Fyers status check (Settings.jsx)
- Had two `useEffect` hooks both calling `checkFyersStatus()`: one with `[]` and one with `[subSection]`
- The `[subSection]` one already runs on mount, making the `[]` one redundant
- Consolidated to single `useEffect` with `[subSection]`
- Also migrated from raw `fetch()` to `authApi()` with consistent URL format, enabling dedup with other `/fyers/status` callers

## Impact
- `/profile/me`: 2 calls -> 1 (eliminated duplicate from App.jsx)
- `/fyers/status`: 3 concurrent calls (VirtualTrading + RealTrading + Settings) -> 1 actual network request (dedup)
- `/portfolio/summary`: 3 concurrent calls (Dashboard + VirtualTrading + Wallet) -> 1 actual network request (dedup)
- `/nse_data/fii-dii-activity`: 2 concurrent calls -> 1 actual network request (dedup)
- All other concurrent GET requests are also automatically deduplicated

## What went well
- The dedup at the `authApi` level is transparent - no component changes needed for most cases
- Caught and fixed a potential circular reference issue between `fastAuthApi` and `authApi`

## No regressions
- POST/PUT/DELETE are unaffected
- After a request completes, the same URL can be re-fetched normally
- Different query parameters = different URLs = separate requests
