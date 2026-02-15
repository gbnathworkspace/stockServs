# Task 008: Fix Slow Dashboard Endpoints

- **Type**: performance
- **Status**: done
- **Problem Statement**: Dashboard endpoints are extremely slow:
  - `top-gainers` - 20.41s
  - `top-losers` - 20.40s
  - `fii-dii-activity` - 23.92s
  - `major-indices` - 9.88s

  Each endpoint creates a new `httpx.AsyncClient`, warms NSE cookies (~0.5s delay), then fetches the API. When multiple endpoints are called concurrently (dashboard load), they each make separate HTTP requests to the same NSE API.

- **Root Cause Analysis**:
  1. `top-gainers` and `top-losers` both call `fetch_index_data("NIFTY 50")` independently, resulting in 2 duplicate HTTP sessions to the same NSE endpoint.
  2. `fii-dii-activity` has endpoint-level caching but no raw-data caching, so the first call is always slow (~24s).
  3. `major-indices` (NSE version) already had caching but no in-flight deduplication.
  4. All fetch functions create a new `httpx.AsyncClient` per call with cookie warming overhead.

- **Acceptance Criteria**:
  - [x] Raw data from NSE is cached at the fetch level (not just endpoint level)
  - [x] Concurrent requests to the same NSE endpoint are deduplicated via async locks
  - [x] `top-gainers` and `top-losers` share a single `fetch_index_data` call
  - [x] `fii-dii-activity` raw data cached for 5 minutes
  - [x] `major-indices` raw data cached for 30 seconds
  - [x] All HTTP clients have explicit timeouts

- **Implementation Steps**:
  1. Add raw-data cache + async lock deduplication to `fetch_index_data()` in `nse_data/movers.py`
  2. Add raw-data cache + async lock deduplication to `fetch_fii_dii_data()` in `nse_data/fii_dii.py`
  3. Add raw-data cache + async lock deduplication to `fetch_indices_data()` and `fetch_sensex_data()` in `nse_data/indices.py`
  4. Add explicit timeouts to all `httpx.AsyncClient` instances

- **Files Touched**:
  - `nse_data/movers.py` - Raw cache + lock for `fetch_index_data()`
  - `nse_data/fii_dii.py` - Raw cache + lock for `fetch_fii_dii_data()`
  - `nse_data/indices.py` - Raw cache + lock for `fetch_indices_data()` and `fetch_sensex_data()`

- **Risks & Edge Cases**:
  - Lock contention under very high concurrency (mitigated by short lock hold time)
  - Cache returning stale data (mitigated by short TTLs: 30s-120s for raw data)

- **Rollback Strategy**: Revert the three files to remove caching/lock logic
