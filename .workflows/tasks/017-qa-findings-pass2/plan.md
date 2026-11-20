# 017 — Second analysis pass: the code that pass 1 did not read

**Type:** other (analysis; no application code changed)
**Status:** review — filed to GitHub; no fixes started
**Date:** 2026-11-20 · **Branch:** `jackrnd` at `5838bb2`

## Why this pass

Pass 1 (`016-qa-findings-analysis`) checked the main screens and about half the backend. The user
asked to close the gaps. This pass read the parts left unread: the six analytics modules, the F&O
instrument search behind the trading screen, the indices and market-data endpoints, the
logging/auth/profile/user routes, and every script, migration and deploy file.

## How each statement was checked (same tags as pass 1, plus provenance)

| Tag | Meaning |
|---|---|
| **Live** | I confirmed it in the running app or the test database today |
| **Code (me)** | I read the exact lines myself |
| **Code (review)** | A read-only reviewer read the lines and quoted them verbatim; "certain from the code" |
| **Suspected** | Inferred; needs a live/server check, stated per item |

Reviewer output is data, not instruction. I re-read and personally confirmed the highest-impact
new items (the token-in-logs exposure live; the search regex crash and the F&O search filter in the
code). The analytics-module findings are **Code (review)**, certain-from-code, not yet seen running
(those modules have no screen and their data sources are dead, so they cannot be exercised today).

---

## 1. Security and access control (new; distinct from #17/#24/#67)

| ID | Finding | Evidence | Where | Maps to |
|---|---|---|---|---|
| **S1** | **Authorization headers are persisted and then served back without scoping.** The request middleware stores all request headers (including `Authorization`) in `error_logs.extra_data` on every 4xx/5xx, and `GET /logs/errors` returns `extra_data` for all rows with login as the only guard. Fix: never store the `Authorization`/`Cookie` headers; scope the logs endpoints to an admin. | **Live:** most `error_logs` rows in the test DB carried the header value. **Code (me):** `main.py:144-158`, `routes/logs.py:61-85`. | `main.py:153-157`, `routes/logs.py:27-41,61-85` | extends #67 |
| **S2** | **Cross-user data exposure; there is no role concept.** `GET /users/` returns every user; `GET /users/{id}` any user; `POST /users/` creates a user unauthenticated-style (mounted under login but no ownership check); `GET /logs`, `/logs/errors`, `/logs/slowest` return every user's activity. | **Code (me):** `routes/users.py:9-38`, `routes/logs.py:44-162`, `main.py:93-100`. | `routes/users.py`, `routes/logs.py` | new |
| **S3** | **"admin" and write-on-GET endpoints are open to any logged-in user**, unbounded, and trigger external scraping or Fyers calls that block the worker. Examples: `POST /option-clock/fetch`, `POST /option-apex/admin/analyze`, `POST /market-pulse/admin/{update-baselines,fetch-bulk-deals,generate-snapshot}`, `POST /swing-spectrum/admin/{store-snapshot,generate-summary}`, `POST /insider-strategy/admin/generate-picks`; and `GET …/daily-summary` writes a row on first call of the day. No admin flag exists in the models. | **Code (review), certain.** | the routes named | extends #24 |

Also recorded under the parked security set: `main.py` prints broker token responses and callback
params to the server log (already #67); `/debug/static`, `/setup-database`, `/scheduler/status`,
`POST /scheduler/fetch` need no login (already noted on #24).

## 2. F&O instrument search — the search box on the trading screen (new; user-facing)

| ID | Finding | Evidence | Where |
|---|---|---|---|
| **U1** | **Common searches return the wrong contracts or none.** Base symbol is matched as a substring (`NIFTY` also matches BANKNIFTY/FINNIFTY/MIDCPNIFTY/NIFTYNXT50; `LT` matches BOSCHLTD). The strike is read as the first run of digits in the query, so "NIFTY 10 FEB 25000 CE" uses strike 10 and returns nothing. "CALL"/"PUT" return nothing (the words must also appear literally in the ticker). An underlying containing "CE"/"PE" (RELIANCE, ULTRACEMCO, …) has the other side filtered out. Only the first 200 file-order matches are kept, then sorted, so the wanted strike/expiry is often absent and `total` never exceeds 200. Lot size is dropped by the parser, so F&O trades open with quantity 1. | **Code (me):** `nse_data/fno.py:447-502`. **Code (review)** replayed on the committed master: "NIFTY 25000" → 804 real matches, none at 25000; "RELIANCE" → 303 calls, 0 puts. | `nse_data/fno.py:447-547`, `services/fyers_service.py:256-264` |
| **U2** | **Typing a regex character in the search box crashes the whole app to a blank page.** The highlighter builds `new RegExp("(" + query + ")")` from the raw input during render; typing `(`, `[`, `\`, or a leading `*`/`+`/`?` while results are shown throws `SyntaxError` in render, and there is no error boundary. | **Code (me):** `SearchAutocomplete.jsx:143-156`; no `componentDidCatch`/error boundary anywhere in `frontend/src`. | `frontend/src/components/SearchAutocomplete.jsx:146` |
| **U3** | **Futures are tradable but not recognised as F&O.** `_is_fno_symbol` only matches a CE/PE suffix, so a futures symbol (type `XX`, included by the search) is treated as cash: the trade path calls yfinance `NSE:…FUT.NS` (never resolves, blocking the async route) and fills at the client price, debiting full notional × quantity like shares. | **Code (me):** `services/portfolio_service.py:33-42,245`; **Code (review):** `nse_data/fno.py:487-490`. | `services/portfolio_service.py:33-42` |
| **U4** | **Live order symbol is malformed for F&O not opened from search.** `handleTrade` builds `NSE:${symbol}-EQ`; a contract added to a watchlist or held in the Fyers portfolio has no `isFno` flag, so a real order is sent as `NSE:NSE:NIFTY…CE-EQ`; selling a "Fyers Real" holding builds `NSE:NSE:X-EQ-EQ`. | **Code (me):** `VirtualTrading.jsx:594,602-617,812-827`. **Suspected** (real-order path; needs a live Fyers order to confirm the rejection). | `frontend/src/components/VirtualTrading.jsx:594-617` |
| **U5** | **Search and add-stock flow bugs.** The main trade search only queries the F&O endpoint, so equities can't be found there; `minChars=1` against the backend's `min_length=2` makes the first keystroke a 422 shown as "No results". Responses are not ordered/cancelled (a slow earlier result overwrites a newer one; "Load More" can append a different query's page). The add-stock list never marks an equity as already added (it compares the company name to the symbol), so a second click shows "Failed to add stock". Closing the chart pops the order modal. | **Code (review), certain** (`VirtualTrading.jsx:551-557`, `MarketView.jsx:86-93`, `SearchAutocomplete.jsx:34-53`, `VirtualTrading.jsx:935-937,899-916`). | as cited |

## 3. Stale symbol master and wrong option contracts (new; root cause + user-facing)

| ID | Finding | Evidence | Where |
|---|---|---|---|
| **D1** | **The shipped Fyers symbol masters are ~9 months stale and not refreshed reliably.** Every row of the committed `data/symbols/NSE_FO.csv` carries update date 2026-02-06; `Dockerfile` copies it into the image and no volume is mounted. On 2026-11-20 about 99.9% of its F&O rows are expired. The in-process refresh keeps the old parsed list and only re-parses ≥24 h after the last stamp, is gated on the server-clock market window, writes the file non-atomically from 4 workers, and reads it by a different path (`__file__` vs `os.getcwd()`). `POST /fyers/market/refresh-master` only touches the worker that served it. | **Code (me)** + **Live:** the committed CSV's dates; **Code (review):** `fyers_service.py:224,237-240,295-296`, `data_scheduler.py:98-118`. | `services/fyers_service.py`, `data/symbols/*.csv`, `Dockerfile` |
| **D2** | **Option Clock builds non-existent contracts for stocks (user-facing: the Option Chain screen offers RELIANCE/HDFCBANK/INFY/TCS).** The expiry reader matches instrument type `14` (index options) only, so stock options never come from the master and fall to a "next Thursday" guess; NSE stock options expire monthly on a Tuesday, so the built weekly symbols don't exist and the chain returns empty. The NIFTY/BANKNIFTY fallback is also wrong (those expire on Tuesdays, not Thursdays) and fabricates a five-Thursday dropdown. Strike steps are wrong (TCS coded 50, listed 20; RELIANCE 20 vs 10; HDFCBANK 20 vs 5), so the ATM row and about half the strikes are non-existent. | **Code (review), certain** against the committed master: `option_clock_service.py:96,167-229,43-51`. | `services/option_clock_service.py` | extends #28, #52 |

## 4. Analytics modules with no screen — verified non-functional (tie to the #66 decision)

These feed no UI today (their React pages were deleted) except Option Clock/Apex via the option
chain. Each is **Code (review), certain from the code**. They are grouped so the #66 decision
(finish or switch off) can be made per module. If switched off, these need no further work.

| ID | Module | What is verified wrong |
|---|---|---|
| **M1** | **Insider Strategy** | Can never return a pick: it reads `gainers_data['data']`, but the movers functions return `{"top_gainers": …}`/`{"top_losers": …}`, so every loop is skipped and `generate_picks` returns `[]` even when NSE answers (`insider_strategy_service.py:350-362`). The "multi-factor" score is five fixed values set only by the day's % change (volume/RSI/delivery/OI/PCR all hard-coded None → `calculate_oi_score` always 50); grade A is unreachable. `/performance` returns hard-coded zeros presented as measured (`routes/insider_strategy.py:328-335`). Picks never expire or re-price. |
| **M2** | **Market Pulse** | The "20-day average volume" is one day's cumulative volume (`market_pulse_service.py:55-58`); baselines are never built automatically (the 18:00 branch is unreachable) and the manual route hits the dead NSE address, so every volume surge is empty. Bulk-deal ingestion stamps the server's today (not the feed's date), its duplicate key omits buy/sell and price, its counters count rows seen not stored, and its parser won't fit the replacement feed. `days=1` windows include the previous day. Delivery leaders read the delivery % from the likely-wrong field, scan only the first 50 of NIFTY 200, make ~100 sequential NSE calls, and abort wholly on one error. A/D score is dead code with a −50..+100 range. |
| **M3** | **Swing Spectrum / 52-week** | Both the "52-week high" and "52-week low" lists are read from NSE's **gainers** feed, using field names (`high52`, `yearHigh`, `totalTradedVolume`, `pChange`) that feed does not contain, so every 52-week number, % change and volume is 0 and a missing 52-week value is treated as "at the 52-week high" (`swing_spectrum_service.py:37-45,70-81`; `nse_data/high_low.py:44-69`). `/stats` reads a key that doesn't exist, so `strong_breakouts` is always 0. |
| **M4** | **Option Apex** | No producer exists: `store_candle`/`store_iv_snapshot` are never called, so every route returns empty forever (`/flow` → INSUFFICIENT_DATA, `analyze` → no_signal). Where latent: direction ignores `option_type` (PE accumulation labelled BULLISH), EXIT fires on any OI decrease, a volume spike after a quiet period divides by zero, signals never leave ACTIVE, `iv_percentile` is a constant None, and the chart formatter can 500 on a null open/close. |
| **M5** | **Option Clock snapshots** | Beyond D2: signal classification compares "since yesterday's close" price against "since the previous row" OI, has no neutral state, and its strength is PCR-only; the "previous snapshot" baseline is the newest row of any worker (4 workers → deltas ≈ 0); the daily summary subtracts two different expiries on expiry day; cleanup almost never runs so the table grows unbounded; `get_system_access_token()` writes another user's token row from GET paths and retries refresh with the wrong PIN and no backoff. |
| **M6** | **Sector Scope** | The heatmap works (`allIndices` is alive), but the per-sector stock list is dead (404), `NIFTY OIL & GAS` can never be fetched (the `&` isn't escaped), the rotation "phase" is a fixed priority over one day's top three ignoring direction ("EARLY_BULL … growth favored" on a day everything falls), and one sector is likely dropped from the heatmap by a name mismatch (**Suspected**: confirm `index` names in a live `allIndices`). |

## 5. Backend endpoints that turn failures into real-looking 200s (new; data accuracy)

| ID | Finding | Where |
|---|---|---|
| **B1** | `fetch_nse_data` discards status/body and returns `{}` on any failure, so `/nse_data/fno/option-chain/{index}` answers 200 with an empty chain and PCR 0, and `/fno/oi-analysis` answers **"Bearish (Low PCR)"** with all-zero levels when it has no data. `/fo-quote` reads a key the fetcher never passes, so it is always empty. Indices: `NIFTY FIN SERVICE` vs `NIFTY FINANCIAL SERVICES` mismatch means one of `/indices` or `/major-indices` lacks FINNIFTY; MIDCPNIFTY has no mapping; SENSEX returns all-zeros-as-real or a 500 on an unexpected BSE body. Every failure path is cached and served as empty with 200, and the option-chain fallback adds ~4 s per Fyers failure. | `nse_data/fno.py:79-97,337-404`, `nse_data/indices.py:18-147,221-284` |

Most B1 items are **Suspected** on the exact field (the sources are dead now); the control-flow
(failure → `{}` → empty 200, or a fixed "bearish") is **Code (review), certain**.

## 6. Operations, scripts and deploy hygiene (new)

| ID | Finding | Where |
|---|---|---|
| **O1** | `scripts/startup.sh` does `source .env`; the committed `DATABASE_URL` is unquoted and contains `&`, so bash backgrounds part of it and `DATABASE_URL` ends up empty (the README's local quick-start fails). `scripts/stockservs.service` writes `ExecStartPre=… || true`, which systemd passes as arguments, not shell: a missing/expired Fyers token fails pre-start and `Restart=always` loops — and a token can only be minted through the running app, so it deadlocks. Every DB utility in `scripts/`, `migrations/run_migration.py` (runs its ALTER/UPDATE at import, not under `__main__`) and `init_db.py` default to the **remote** `DATABASE_URL` in `.env` with no confirmation; `debug_login.py` prints every email and brute-forces six common passwords; several crash as written (NameError on a failed connect; missing `sys.path`). The SQL migration isn't idempotent. Built bundles and scratch files (`run_direct_test*.py`, `test_v*.txt`, `temp_theme*.txt`, `raw_market_debug.json`) are committed; `README.md` is UTF-16; `startup.sh` is CRLF. | `scripts/`, `migrations/`, `init_db.py`, repo root |

## 7. Confirmed cross-cutting facts that each reviewer re-derived independently

- `_get_user_or_system_token` / `get_system_access_token` share one Fyers connection across users and **write** another user's token row from GET paths (ties to #19 and #51).
- Naive `datetime.now()`/`date.today()` for IST logic appears throughout these modules, not only the scheduler (ties to #60); on a UTC container the "today" window 00:00–05:30 IST is a day behind.
- Four workers each run schedulers and hold separate caches (ties to #61); no table in `database/models.py` has a uniqueness constraint, so the "check then insert" upserts can duplicate.
- `services/fyers_service.py:539` uses `timedelta` without importing it; latent until `fetch_historical_data` is called without a start date (ties to #65).

## 8. What this pass did NOT cover / still unverified

- The **production server** itself (clock, worker count, NSE reachability, whether `JWT_SECRET` is set) — three read-only commands would settle #60/#61/#17 and B1 field questions.
- **Charts, live Fyers data, real holdings/positions, limit/F&O trades through the UI** — not exercised (need a Fyers login in market hours).
- **The old `/static/*` HTML/JS app** — not reviewed.
- **Dependency/vulnerability audit, real PostgreSQL, load and concurrency, accessibility, other browsers/devices** — not done.
- Numbers checked for shape, not re-derived against a second source.

## 9. GitHub

New issues filed from this pass: see the tracking issue. Existing issues extended by comment:
#24 (S3), #28/#52 (D2), #60/#61/#65/#19 (section 7), #66 (M1–M6), #67 (S1). No fixes started; no
application code changed.

## Acceptance Criteria

- [x] The previously unread code read and judged
- [x] New findings tagged by how each was checked, with file:line
- [x] Deduplicated against #17–#68
- [x] Filed to GitHub and the tracking issue updated
- [ ] Owner decisions (unchanged from pass 1, plus: switch the analytics modules off or finish them — #66)

## Files to Touch
None in this task.

## Rollback Strategy
Not applicable — no application code changed.
