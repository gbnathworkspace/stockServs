# Outcome: Fix Slow Dashboard Endpoints

## What happened

Added two-layer caching to all NSE data fetch functions:

1. **Raw-data cache**: Caches the HTTP response data at the fetch level, so multiple endpoints sharing the same underlying data (e.g. `top-gainers` and `top-losers` both use `NIFTY 50` index data) only trigger one HTTP call.

2. **In-flight deduplication**: Uses per-endpoint `asyncio.Lock` with double-check pattern, so concurrent requests during a cache miss only trigger a single HTTP call while others wait for the result.

## Expected performance improvement

- **top-gainers + top-losers**: From 2 separate 20s HTTP calls to 1 shared call. Second endpoint serves from raw cache instantly. Subsequent calls within 2 minutes served from cache.
- **fii-dii-activity**: From 24s per call to instant (5-minute raw cache). Triple frontend calls all served from same cache entry.
- **major-indices (NSE)**: From 10s per call to instant (30s raw cache). Already had endpoint cache but now has fetch-level cache too.

## Files changed

- `nse_data/movers.py` - `fetch_index_data()` now caches raw data for 120s with per-index async lock
- `nse_data/fii_dii.py` - `fetch_fii_dii_data()` now caches raw data for 300s with async lock
- `nse_data/indices.py` - `fetch_indices_data()` cached 30s, `fetch_sensex_data()` cached 30s, both with async locks
