# 016 — Verified analysis of the QA findings (#17–#49): root causes, proposed fixes, future work

**Type:** other (analysis; no application code changed)
**Status:** review — waiting for the owner's decisions before any fix starts
**Date:** 2026-11-20 · **Branch analysed:** `jackrnd` at `b01f2cd` (app code identical to `main`)

## Problem Statement

33 issues (#17–#49) were filed from the 2026-11-19 end-to-end test. Most were described from
what the screen showed, not from the code. Before fixing anything, each one needed its real cause
confirmed, a concrete fix proposed, and the remaining work after the fixes identified.

## How each statement here was checked

| Tag | Meaning |
|---|---|
| **Code** | Read in the source at the cited `file:line` |
| **Live** | Observed in the running app, its API, its database, or the page's structure (local run on a throwaway SQLite DB) |
| **Docs** | Fyers API v3 documentation (`fyers.in/api-docs/v3`), read 2026-11-20 |
| **Not verified** | The cause is inferred; the row says what is needed to confirm it |

Nothing in this document is taken from yesterday's screenshots alone. Three of yesterday's
findings turned out to come from the test setup, not the app (section 1).

---

## 1. Corrections to the issues as filed

| Issue | As filed | What is actually true |
|---|---|---|
| **#29** candles ignore timeframe | Daily request returned 5-minute candles | **Invalid — my test error.** The endpoint's parameter is `interval` (`routes/fyers_market.py:265`); the test sent `resolution=D`, which is ignored. The app's chart sends `interval=5m\|15m\|1d` (`ChartModal.jsx:5-9,193`) and the backend maps it correctly (`fyers_market.py:284-300`). Close. |
| **#47** light-mode "Settings" unreadable | Label nearly invisible | **Invalid.** Measured once the theme change settles: text `rgb(26,29,33)` on white, contrast 16.9:1. The screenshot caught a 0.15 s colour transition that the automated browser had not finished drawing. Close. |
| **#30** bid/ask swapped | Mapping bug | **Not an app bug.** The backend passes Fyers' own `bid`/`ask` through unchanged (`services/fyers_service.py:451-452`) and no screen displays them (no use anywhere in `frontend/src`). Close, or reduce to "remove unused fields". |
| **#40** tab highlight lags one click | State lags | **Wrong description.** The active class is set correctly and immediately (**Live**: read from the page after each click). The real bug is a CSS rule that makes the *hovered* active tab unreadable — see F1. |
| **#46** layout | Sidebar background stops; header and table clipped | **Partly invalid.** The sidebar is `position: fixed; height: 100vh` (`styles.css:2110-2113`); a full-page screenshot draws it once, a real user never sees it stop. Clipping is real only in narrower windows — measurements in F3. |
| **#35** Watchlist page empty | Probably wrong API shape | **Different cause.** The page never calls the server; it keeps a separate list in the browser — see E1. Effort is medium, not easy. |
| **#33** Dashboard ₹0 | When prices are missing | **Worse.** Current Value and P&L are always ₹0 — see A8. |
| **#28** option-chain OI | Field mapping; wrong Max Pain shown | Cause is the **choice of Fyers API**, not field names; Max Pain is wrong in the API but is not displayed on the Option Chain screen (PCR 0 and OI 0 are) — see D1. |
| **#26** Bulk Deals fake data | No indication | The API does mark it (`"source": "simulated"`); the **screen drops the marker** — see C2. |
| **#23** Live switch in trade window | One click from real money | **Understated.** The window can open with "Fyers Live" already selected while the page is in Sandbox — see B1. Highest priority. |
| **#20** any-price trades | MARKET orders | LIMIT orders have the same hole (A2). A server-side price source already exists for cash equities, so effort is medium, not hard (A1). |

---

## 2. Root causes and proposed fixes

Effort: **E** = under ~1 hour, **M** = half a day to a day, **H** = more than a day or needs a decision.

### A. Sandbox trading correctness

| ID | Verified cause | Evidence | Proposed fix | Effort |
|---|---|---|---|---|
| **A1** (#20) | MARKET orders fill at the price in the request: `execution_price = _round_price(payload.price)` (`services/portfolio_service.py:289`). The server already looks up a price for cash symbols with yfinance (`_fetch_ltp`, `:59-88`, used at `:245`) but only returns it as `market_price`, which the response model then drops (`schemas/portfolio.py:56-61`). For F&O the request price is used by design (`:245`). | **Code**, **Live** (₹1 buy / ₹99,999 sell moved the wallet from ₹1,00,000 to ₹1,99,998) | The server sets the fill price: Fyers quote when a market-data token is available → yfinance for cash equities → otherwise reject with "price unavailable". Remove the hand-typed price for MARKET orders. F&O needs a Fyers quote (yfinance cannot price options). | M |
| **A2** (new) | LIMIT orders are filled immediately at the limit price whatever the market is: buy-limit below market and sell-limit above market are both marked `FILLED` at the limit (`portfolio_service.py:248-286`). Nothing processes a `PENDING` status. | **Code** | Step 1: reject a LIMIT that would not trade at the current price; fill marketable ones at the server price. Step 2 (later): real pending orders with a matcher job and cancel. | E (step 1), H (step 2) |
| **A3** (#21) | The symbol is only trimmed and upper-cased (`_sanitize_symbol`, `:16-20`); no lookup. | **Code**, **Live** (`NOTAREALSTOCK` accepted) | Validate against the symbol masters (`data/symbols/NSE_CM.csv`, `NSE_FO.csv`). With A1, "no server price" also rejects unknown symbols. | E |
| **A4** (new) | Wallet and holdings are read, changed and written without a row lock (`:295-353`); `virtual_holdings` has no unique `(user_id, symbol)`; money is stored as `Float` (`database/models.py:63,76,90-91`). | **Code**. Not reproduced (needs concurrent requests) | Lock the wallet row during a trade, add the unique constraint, move money to `Numeric`. Needs a migration approach first (G5). | M |
| **A5** (new) | Order status column prints "Executed" for every row (`OrdersView.jsx:43-45`); the API's `status` is ignored. | **Code** | Render the real status. | E |
| **A6** (new) | `GET /portfolio/orders` writes: `_sync_missing_orders` creates a BUY order, timestamped now, for any holding without one (`portfolio_service.py:178-213`). | **Code** | One-off data backfill, then delete the function. | E |
| **A7** (#32) | Times are stored as UTC without a zone (`models.py:94`), sent without an offset (`portfolio_service.py:229`), and parsed by the browser as local time (`OrdersView.jsx:33`, `Wallet.jsx:71-72`). | **Code**, **Live** (DB row `2026-11-19 07:33:05` for an order placed at 13:03 IST; screen shows 7:33 am) | Serialise every timestamp as UTC with `Z` in one helper; format in the UI with `timeZone: 'Asia/Kolkata'`. | E |
| **A8** (#33) | The Dashboard reads `summary.current_value` (`Dashboard.jsx:101`); the API field is `holdings_value`, and the backend deliberately returns `holdings_value`, `total_pnl`, `net_worth` as `None` (`portfolio_service.py:156-175`). | **Code**, **Live** (Invested ₹10, Current Value ₹0, P&L +₹0) | Compute value and P&L on the server with the A1 price source (the unused `_enrich_holdings` at `:114-131` already does this with yfinance), return numbers or `null`; show "—" for `null`. | E–M |
| **A9** (new) | The Dashboard "Balance" card navigates to `wallet.balance`, a section `App.jsx` has no case for (`Dashboard.jsx:141`, `App.jsx:96-138`). | **Code**, **Live** (click leaves the Dashboard showing with no menu item active) | Route it to Trading → Wallet. | E |
| **A10** (#48) | `POST /portfolio/funds` accepts any positive amount (`schemas/portfolio.py:28-37`); the UI calls resets "Subscription Plans" (`Wallet.jsx:158-198`). Settings → "Reset Wallet" only shows `alert('…coming soon!')` (`Settings.jsx:77-81`). | **Code** | Decide: free sandbox money (rename to "Reset sandbox balance", wire the Settings button to it) or real plans (product work). | E / decision |

### B. Live versus Sandbox

| ID | Verified cause | Evidence | Proposed fix | Effort |
|---|---|---|---|---|
| **B1** (#23, critical) | (a) The Sandbox trade window offers "Virtual / Fyers Live" (`TradeModal.jsx:82-96`); choosing Fyers Live sends `POST /fyers/order` with no confirmation (`VirtualTrading.jsx:600-629`). (b) The choice is kept in the window's own state and never reset (`TradeModal.jsx:14-30`: `broker: isLive ? 'fyers' : prev.broker`), so after one visit to Live mode every later Sandbox trade window opens with **Fyers Live selected**. (c) In Live mode with no broker connected the tabs are disabled but stock cards still open the Live order window. (d) No confirmation step anywhere; the backend forwards any JSON to Fyers unchecked (`routes/fyers.py:244-258`). | **Code**, **Live** for (b) and (c): page mode `sandbox`, toggle read as "Fyers Live [SELECTED]", no Available Balance row. No order was placed. | Take the broker from the page mode only (no toggle, no remembered state): Sandbox → virtual, Live → Fyers and only when connected. Reset the form each time it opens. Add a confirmation step for real orders (symbol, side, quantity, type, price, product, value, "REAL ORDER"). Server: typed order schema with limits. Until done, a server switch that refuses live orders is a one-line safeguard. | M (do first) |
| **B2** (#22) | Orders are always loaded from `/portfolio/orders` whatever the mode (`VirtualTrading.jsx:254-264`); there is no Fyers order-book endpoint (`routes/fyers.py` has auth-url, status, callback, holdings, positions, order, disconnect, all-stocks). | **Code**, **Live** | Add `GET /fyers/orders` and `/fyers/trades`. The installed SDK has `orderbook()` and `tradebook()` (**Live**: checked in the environment); response shapes per **Docs** (`orderBook[]` with numeric `status`, `orderDateTime` in IST). Live mode renders only these. | M |
| **B3** (#38, new part) | Live → Portfolio starts on "Virtual" because `showFyersPortfolio` defaults to `false` regardless of mode (`VirtualTrading.jsx:88,804-817`). The Fyers view maps `ltp: h.lp` (`:816`), but Fyers' holdings use `ltp` (**Docs**), so real holdings would show no price or P&L. Positions are fetched by no screen (`/fyers/positions` is never called from `frontend/src`). | **Code**, **Docs**. The `lp` effect is not seen live (the test account has no holdings). | In Live show only broker data: holdings (`ltp`, `costPrice`, `pl`, `marketVal`), positions, and Fyers' `overall` totals. | M |
| **B4** (#42) | Switching mode does not reset the open tab (`VirtualTrading.jsx:28-31,749`), and content is not gated by mode: on the Wallet tab, switching to Live removes the Wallet tab button but keeps the sandbox wallet on screen. | **Code**, **Live** | Reset the tab on mode change; choose content by mode and connection. | E |
| **B5** (#41) | The sidebar badge reads `localStorage` when it renders (`Sidebar.jsx:158-162`); nothing tells it the mode changed. | **Code**, **Live** (badge "Sandbox Mode DEMO" while stored mode was `live`) | One shared trading-mode state used by the sidebar, the Trading page and the trade window. Decide whether the mode should survive a reload at all (safer: always start in Sandbox). The header's "Live (n)" button is the auto-refresh pause control (`RefreshControl.jsx:69`) — rename it. | M (fixes B4, B5 and part of B1 together) |
| **B6** (#34) | `fetch_fyers_holdings` / `fetch_fyers_positions` return `[]` when Fyers answers with an error, without logging; the `overall` totals are discarded (`fyers_service.py:169-195`). | **Code** | Return the Fyers error (502 with its message); show "couldn't load from Fyers". | E |
| **B7** (new) | The app assumes a token lasts 24 hours (`expires_at = utcnow() + 1 day`: `routes/fyers.py:199,206`, `fyers_market.py:62`, `option_clock_service.py:156`) and compares that UTC value with local `datetime.now()` (`routes/fyers.py:61`, `fyers_market.py:48`, `option_clock_service.py:141`). Fyers ends every token daily at 6:30 AM (**Docs**). Auto-refresh uses one server-wide `FYERS_PIN` (`fyers_service.py:131-147`), which can only match one account. | **Code**, **Docs**, **Live** (token issued 15:26 IST was rejected at 10:30 next morning with `-15 Please provide valid token` while the stored expiry said 15:26) | Store the real expiry (next 6:30 AM IST); treat a Fyers auth error as "disconnected" at once and prompt to reconnect; timezone-aware comparisons. | E–M |
| **B8** (new) | Logout removes only `access_token` and `user_email` (`App.jsx:82-86`, `Settings.jsx:72-73`, `api.js:20-26`); `trading_mode`, `user_name`, `profile_pic` and the local `watchlist` stay for the next person on that browser. | **Code**, **Live** (`trading_mode` still present after logout) | One `logout()` that clears every app key except the theme. | E |

### C. Market data

**C1 (#27) — what NSE answers today.** Checked 2026-11-19 and 2026-11-20 from an Indian network.
Every `https://www.nseindia.com/api/…` address returns `301` to `https://www.nseindia.in/api/…`. On the new host:

| NSE address (path after `/api/`) | Result | Used by |
|---|---|---|
| `equity-stockIndices?index=…` | **404** | Top Gainers, Top Losers, Nifty Contributors, `/nse_data/all-stocks`, Weekly Movers "today" overlay |
| `snapshot/capital-market/bulk-block-deals` | **404** | Bulk Deals, Market Pulse ingestion |
| `option-chain-indices?symbol=…` | **404** | Option-chain fallback when Fyers fails |
| `historical/bulk-deals` | 503 | (unused fallback) |
| `fiidiiTradeReact` | 200 | FII/DII |
| `allIndices`, `marketStatus` | 200 | `/nse_data/indices` |
| `live-analysis-variations?index=gainers` and `…=loosers` | 200 | **replacement** for gainers/losers (`NIFTY.data[]`: `symbol, ltp, perChange, prev_price, open_price, high_price, low_price`) |
| `snapshot-capital-market-largedeal` | 200 | **replacement** for bulk/block deals (`BULK_DEALS_DATA[]`: `symbol, clientName, buySell, qty, watp, date, remarks`; `as_on_date`) |

The failure text reaches users because `_do_fetch_index` raises `HTTPException(500, detail=str(e))`
(`nse_data/movers.py:76-78`) and the page prints `detail` (`NiftyContributors.jsx:83-92`, `lib/api.js:58-62`).
**Not verified:** whether the production server (an AWS address) can reach NSE at all; the code's own
comments ("if NSE blocks us", "Use Proxy for Real") suggest it has been blocked before.
Check on the server: `docker exec stock_servs curl -sI https://www.nseindia.in/api/allIndices`.

| ID | Verified cause | Evidence | Proposed fix | Effort |
|---|---|---|---|---|
| **C1** (#27) | See table above. | **Live** | Gainers/losers from `live-analysis-variations`, mapped to the existing response shape. Nifty Contributors and all-stocks need constituents with prices: one Fyers quotes call for 50 symbols when a market-data token exists, else yfinance, with the constituent list kept in a maintained file. Show a plain message and log the detail. | M |
| **C2** (#26) | The old address is dead, so `get_mock_bulk_deals()` runs (`nse_data/bulk_deals.py:76-113`). The API marks it (`"source": "simulated"`, per-row `remarks`), but the page keeps only `res.bulk_deals` and shows four columns (`MarketData.jsx:45,233-257`). Market Pulse's ingestion uses the same dead address (`services/market_pulse_service.py:25,169`). | **Code**, **Live** | Switch to `snapshot-capital-market-largedeal`, map the fields, delete the generator, show the date and a Buy/Sell column, show "unavailable" when there is no data. | E–M |
| **C3** (new) | FII/DII figures are divided by 100 before display (`FiiDiiActivity.jsx:40,224,231` with the comment "API returns in Cr * 100"; `Dashboard.jsx:96`; `MarketData.jsx:62`). NSE publishes these in ₹ crores. | **Code**, **Live** (stored for 18 Nov: FII buy `17913.16`; screen: "₹179.13 Cr"; NSE raw for 19 Nov: `"buyValue":"20706.95"`) | Remove the division; one shared formatter. Before release, look at the magnitudes in production's `fii_dii_daily` (rows inserted by `scripts/backfill_fii_dii.py` may use another unit). | E |
| **C4** (#31) | `(fii?.netValue \|\| 0) + (dii?.netValue \|\| 0)` adds two strings (`FiiDiiActivity.jsx:370,379-380,515-517`), giving `NaN` and the wrong colour. | **Code**, **Live** | Return numbers from the API (`parse_numeric` exists at `nse_data/fii_dii.py:159`); format negatives as `-₹`. | E |
| **C5** (#39) | No caching although the key and TTL exist (`routes/nse_data.py:33-41`, `services/cache.py:88,125`); 137 hard-coded symbols labelled "NIFTY 100" (`nse_data/weekly_gainers.py:16-39`), one yfinance call each; `LTIM.NS` no longer resolves. | **Code**, **Live** (7.9 s) | Cache the result, or compute it in the scheduler after close; keep the list in a maintained file. | E |
| **C6** (new) | Nifty Contributors invents open-interest signals: the backend always sends `oiChange: 0` (`nse_data/movers.py:263-265`), and the page still labels every riser "Short Covering", every faller "Long Unwinding" and derives a "Weak Rally" banner (`utils/indexContribution.js:124-132,153-167,207-220`; `ContributorCard.jsx:9,39`). Index weights are hard-coded "approximate" values (`indexContribution.js:8-59`). | **Code**. Not visible today because the page fails (C1) | Hide the OI label and strength banner until real OI exists; serve weights from the backend with an "as of" date. | E to hide, M to do properly |
| **C7** (#37) | The banner "Market closed — enter price manually…" is shown whenever there is no price (`TradeModal.jsx:75-79`), not when the market is closed. | **Code**, **Live** | Word it by cause; with A1 the manual-price path disappears. | E |
| **C8** (#44) | Missing prices are rendered as `₹0.00` in red with ▼ (`MarketView.jsx:14-16,43-45`); the API also fills `lastPrice: 0` (`fyers_market.py:149-180`). | **Code**, **Live** | Send `null`, render "—" in a neutral colour. | E |
| **C9** (new) | Market hours are worked out in three places in the frontend — `utils/marketHours.js` (correct, uses IST), `Dashboard.jsx:112-120` and `OptionChain.jsx:122-131` (use the viewer's local clock) — and again in the backend. None knows NSE holidays. | **Code** | One frontend helper, one backend helper with an IST zone and a holiday list. | E–M |

### D. Option chain and charts

| ID | Verified cause | Evidence | Proposed fix | Effort |
|---|---|---|---|---|
| **D1** (#28) | The chain is assembled from Fyers **quotes** and reads `oi` / `open_interest` / `pdoi` from them (`services/option_clock_service.py:289-375,412-418`). The quotes response has no open-interest field (**Docs**). Task 009 in the archive changed the field *names* on the same assumption, which is why the problem never went away. Consequences: PCR is always 0 on screen, Max Pain and "highest OI strike" in the API are meaningless, and every Option Clock snapshot the scheduler stores has zero OI. | **Code**, **Docs**, **Live** (0 OI on all 31 strikes with prices and volume present) | Use Fyers' Option Chain call (`fyers.optionchain`, present in the installed SDK): per strike `oi, oich, prev_oi, ltp, volume, bid, ask`, plus `callOi`, `putOi`, `expiryData`, and Greeks/IV with `greeks=1` (**Docs**). One call replaces the hand-built symbol names and batched quotes. **Not verified live** — the token expired at 6:30 AM; needs one read-only call after a fresh Fyers login in market hours. | M |
| **D2** (new) | The expiry chosen in the dropdown is sent (`OptionChain.jsx:40-43`) and ignored: the route never passes `expiry` on (`fyers_market.py:395-417`) and the service always uses the nearest expiry (`option_clock_service.py:325`). The table and its B/S buttons then show nearest-expiry contracts under the chosen date. | **Code** | With D1, pass the chosen expiry to the option-chain call. | with D1 |
| **D3** (#29) | Invalid — see section 1. | **Code** | Close. | — |
| **D4** (new) | Chart, read from code only: indicator toggles apply one click late (`ChartModal.jsx:232-243` reloads with the previous `showIndicators`); no range button is highlighted at first (`:17,281`); candle times are passed to the chart as raw epoch seconds, which it draws in UTC (no offset anywhere), so the intraday axis would read 03:45 for 09:15 IST; `fetch_historical_data` uses `timedelta` without importing it (`fyers_service.py:9,539`), which only fails if called without a start date. | **Code**. **Not verified** on a running chart (needs Fyers connected) | Fix after confirming on a live chart. | E each |
| **D5** (#30) | Not an app bug — see section 1. | **Code** | Close. | — |
| **D6** (new) | Lot sizes are hard-coded in the frontend (`VirtualTrading.jsx:856`: NIFTY 75, BANKNIFTY 15, FINNIFTY 25, MIDCPNIFTY 50; everything else 1). | **Code**. Current official lot sizes were not checked | Serve lot size from the F&O symbol master. | E |

### E. Watchlist

| ID | Verified cause | Evidence | Proposed fix | Effort |
|---|---|---|---|---|
| **E1** (#35) | Two unrelated watchlists. The Watchlist page stores its list in `localStorage['watchlist']` and never calls the server (`sections/Watchlist.jsx:24-30,125-140`, comment "Load from localStorage for now"). Trading uses the server's watchlists (`VirtualTrading.jsx:285-364`, `routes/watchlist.py`). | **Code**, **Live** (API returns the Default list with 5 stocks; the page's storage key is empty) | Extract Trading's watchlist block into a shared component and use it on the page — or remove the page and link to Trading. | M |
| **E2** (new) | Watchlist responses are cached in process memory for 60 s (`routes/watchlist.py:56-60,240-243`, `services/cache.py`) and production runs 4 worker processes (G2), so a change made through one worker can be invisible through another for up to a minute. | **Code**. Not reproduced (needs a multi-worker run) | Drop this cache (the queries are tiny) or use a shared cache. | E |
| **E3** (new) | Any string can be added as a symbol (`watchlist.py:333-338`); `GET /watchlist` creates the Default list as a side effect (`:70-93`). | **Code** | Validate symbols; create the default list at signup. | E |

### F. Interface

| ID | Verified cause | Evidence | Proposed fix | Effort |
|---|---|---|---|---|
| **F1** (#40) | `button:hover:not(:disabled) { background: var(--hover-bg) }` (`styles.css:971`) outranks `.virtual-tab.active`, `.nav-item.active` and `.nav-subitem.active`. | **Code**, **Live**: active tab is `rgb(16,185,129)` with the mouse away and `rgb(28,32,41)` under the mouse, text stays `rgb(10,11,14)` — near-black on dark grey. The class itself was correct on every click. | Lower the global rule's weight (`:where(...)`) or scope it to plain buttons; then review other buttons that rely on it. | E |
| **F2** (#43) | Trading uses its own toast (`.virtual-toast`: fixed at top-right, `z-index: 1000`, `styles.css:1148-1157`) while the trade window's overlay is `z-index: 10000` (`trading/modal.css:16`), so trade errors sit underneath it; the same position covers the header's right side. A global toast system exists (`ToastContext.jsx`) and Trading does not use it. | **Code**, **Live** | Use the global toasts everywhere, above overlays and below the header; show form errors inside the trade window. | E |
| **F3** (#46) | Measured: the orders table needs 683 px; its box is 944 px at a 1280 px window (fits), 688 px at 1024 px (Status column cut by 18 px) and 594 px at 930 px (cut by 112 px), with `overflow-x: hidden` on the page section (`styles.css:1145`) so it cannot be scrolled. The header fits at 1024 px and 1280 px; at 930 px on the Dashboard it overflows by 19 px (Logout clipped). At 375 px the sidebar's collapse button (`styles.css:2166-2170`) stays visible as a 13 px sliver over the menu button. | **Live** | Scrollable table wrapper; let the header wrap; hide the collapse button under 768 px. | E |
| **F4** (#47) | Invalid — see section 1. | **Live** | Close. | — |
| **F5** (#45) | The Google client ID is typed by the visitor and kept in `localStorage` (`pages/Login.jsx:19-37,110-116`); the backend needs `GOOGLE_CLIENT_ID` (`routes/auth.py:23,171-172`), which the deploy workflow does not pass, so Google sign-in cannot work as deployed. The Google script loads on every page (`main.jsx:11-16`). | **Code** | Configure it at build and on the server, or remove the block. | E |
| **F6** (#36) | `ensure_profile` stores the e-mail as the display name (`routes/auth.py:67-74`); the name sent at signup is unused. Settings → Save writes the name to `localStorage` only (`Settings.jsx:96-99`). | **Code**, **Live** | Save it at signup; Settings → `PUT /profile/me`; the header reads the profile. | E |
| **F7** (new) | Controls that do nothing: Currency Format, Chart Default Interval, Trade Notifications, Price Alerts (`Settings.jsx:132-181`, no handlers); "Reset Wallet" (A10). Fyers connect results use `alert()` (`App.jsx:47-53`). | **Code** | Remove or wire each one. | E |
| **F8** (new) | Refreshing or bookmarking `/login` or `/signup` returns a raw `{"detail":"Not Found"}`: the router has no `basename` while the server serves the app only under `/app/*` (`main.jsx:32-59`, `vite.config.js`, `main.py:250-259`). App sections are not URLs at all (`App.jsx:25`), so a refresh always returns to the Dashboard and Back does nothing. | **Code**, **Live** (`GET /login` → 404) | Serve the app for those paths (or set `basename="/app"`); later, a route per section. | E now, M for routes |
| **F9** (#48, #49) | Missing spaces in broker labels, Zerodha mentioned as supported, favicon 404, no `autocomplete`, and the Dashboard retries failing calls every 10 s in market hours (`Dashboard.jsx:21`). | **Code**, **Live** | As filed; add back-off to auto-refresh. | E |

### G. Production-only findings (from configuration; a local run cannot show them)

| ID | Finding | Evidence | Proposed fix | Effort |
|---|---|---|---|---|
| **G1** (new) | Nothing sets a time zone for the container (`Dockerfile`, `.github/workflows/deploy.yml:74-82`, `scripts/startup.sh`), and the backend uses `datetime.now()` for Indian-market logic: scheduler window "9 AM–6 PM IST" (`services/data_scheduler.py:96-99,134-145`), end-of-day jobs at `hour == 15` / `18` (`:197-203,353-361`), option-chain `spotSource` (`fyers_market.py:444-448`), expiry roll-over at 15:30 (`option_clock_service.py:172-184,201-213`). On a UTC clock all of these run 5½ hours late (the window becomes 14:30–23:30 IST). Only the FII/DII scheduler names `Asia/Kolkata`. | **Code**. **Not verified** on the server: `docker exec stock_servs date` | An IST-aware `now_ist()` helper everywhere (stop-gap: `-e TZ=Asia/Kolkata`). | M |
| **G2** (new) | Production starts `uvicorn … --workers 4` (`scripts/startup.sh`). Each process starts its own scheduler thread and FII/DII scheduler (`main.py:111-113,289-293`) and has its own memory cache. Expected effect: four times the outside calls, four Option Clock snapshots per interval with no de-duplication (`option_clock_service.py:566-624`), caches that disagree (E2). | **Code**. **Not verified** on the server (count snapshot rows per minute) | Run schedulers in one dedicated process; shared cache, or one worker for now. | M |
| **G3** | No automated tests and no test step before deploy (`deploy.yml` builds and deploys every push to `main`). | **Code** | See future work. | — |
| **G4** | Background analytics with no screen still run or are exposed (Option Clock, Option Apex, Market Pulse, Insider Strategy, Swing Spectrum, Sector Scope). Option Clock stores all-zero OI (D1); Market Pulse reads a dead address (C2). | **Code**, **Live** | Decide: finish them on real data or switch them off. | decision |
| **G5** | Tables are created by `create_all` at import (`main.py:35`); there is no migration tool (one hand-written SQL file). | **Code** | Needed before A4 and timezone-aware columns. | M |
| **G6** | Built frontend bundles (4 JS, 3 CSS, only one of each current) and scratch files (`test_v*.txt`, `temp_theme*.txt`, `run_direct_test*.py`, `api_responses.json`, `raw_market_debug.json` …) are committed; `README.md` is UTF-16. | **Live** (`git ls-files`) | Untrack, ignore, clean. | E |

### H. Parked for now (login and security) — recorded so they are not lost

#17 JWT secret, #18 committed `.env`, #24 open scheduler endpoints, #25 password rule: unchanged.
Additions from this pass, fix-only wording:

- **#19** is a design choice, not an accident: `_get_user_or_system_token` falls back to "any valid token in the database" for market data (`routes/fyers_market.py:33-69`). Account calls (holdings, positions, orders) use only the caller's own token (`routes/fyers.py:222,237,253`). Decision needed: a dedicated market-data account, or per-user data only.
- `/setup-database` and `/debug/static` also answer without login (**Live**: 200).
- Broker token responses and callback parameters are printed to the server log (`routes/fyers.py:114,174`; `fyers_service.py:109`); the session token is passed through the broker redirect as `state`.
- `POST /nse_data/fii-dii-backfill` lets any signed-in user insert FII/DII history (`nse_data/fii_dii.py:219-260`).
- Sessions last 7 days with no way to revoke (`routes/auth.py:22`).

---

## 3. Implementation Steps (proposed order — nothing started)

| Batch | Contents | Rough effort |
|---|---|---|
| **0 — stop accidental real orders** | B1 (broker from page mode, reset on open, confirmation, server guard) | ½ day |
| **1 — quick correctness** | C3, C4, A7, A9, A5, A6, C7, C8, F1, F2, F3, F6, F8 (first part), B8, B4, C5, A3; close #29, #47, #30 | 1½–2 days |
| **2 — data sources** | C1, C2, D1 + D2 (needs a Fyers login in market hours), B7, B6, C6 (hide), C9 | 2–3 days |
| **3 — Live mode done properly** | B5 shared mode state, B2 orders/trades, B3 holdings/positions, rest of B1 on the server | 3–4 days |
| **4 — trading engine** | A1 server pricing, A2 limit orders, A8, G5 migrations then A4 | 3–5 days |
| **5 — platform** | G1 time zone, G2 scheduler/worker split, E1 watchlist page, E2, G6 | 2–3 days |
| **6 — parked security** | #17, #18, #19, #24, #25 and section H | 1–2 days |

Roughly 3–4 weeks of work for one developer, 4–5 with tests written alongside. Batches 0 and 1
(about two days) remove the dangerous and the most misleading behaviour.

## 4. Future work after these fixes

1. **Tests and a deploy gate.** There are none today. Start with the trade engine (pricing, limits, balances), time handling and the FII/DII formatter; add a browser smoke test built on the `stockservs-local-e2e` skill; stop deploying untested pushes.
2. **Market-data architecture.** One provider layer instead of calls scattered across routes; a dedicated data feed (service account or paid data) instead of "whoever logged in to Fyers last"; live ticks over Fyers' WebSocket instead of 5–10 s polling; a shared cache; an NSE holiday calendar. Scraped NSE pages and yfinance should become fallbacks, not sources.
3. **Paper-trading realism.** Pending limit and stop orders with a matcher, market-hours rules, charges, F&O margin and lot checks, expiry settlement, intraday versus delivery, order cancel/modify, P&L history.
4. **Live trading scope.** Order book, trades, funds, positions, modify/cancel, product types, an audit log, and a daily re-login flow (tokens end at 6:30 AM). Placing broker orders for users may carry regulatory requirements; that needs someone qualified to check — it is outside what this analysis can assess.
5. **Analytics modules.** With the option-chain call in place (D1), PCR, Max Pain, historical OI, Greeks and IV — the open items in `docs/TASKS.md` — become possible. Each module needs a screen or should be removed.
6. **Platform.** Migrations, timezone-aware timestamps, schedulers as their own process, structured logging without tokens, monitoring and alerts, rate limits, backups, and separate development and production databases (the committed `.env` points local runs at production data).
7. **Frontend structure.** Real URLs per section, shared state for mode/user/profile, removal of duplicate or dead components (`components/Settings.jsx`, `sections/OrderHistory.jsx`, the FII/DII branch inside `MarketData.jsx`), splitting the 7,279-line stylesheet (it defines `.main-header` and others twice), bundle size (487 KB), accessibility.
8. **Repository hygiene and docs.** G6, plus the open docs task 014.

## 5. Not verified yet, and what each needs

| Item | Needs |
|---|---|
| D1 — the option-chain call returns OI as documented | One read-only call after you reconnect Fyers, in market hours |
| D4 — chart behaviour | A chart open with Fyers connected |
| B3 — real holdings show no price | An account with at least one holding, or the fix itself |
| G1, G2, C1 on the server | Three commands on the production host (clock, snapshot row counts, NSE reachability) |
| A4, E2 — races and stale cache | A concurrent / multi-worker test |
| C3 — unit of back-filled history | One query on production `fii_dii_daily` |
| D6, C6 — current lot sizes and index weights | The exchange's current published values |

## 6. Decisions needed from the owner

1. **Sandbox prices without Fyers:** is a delayed yfinance price acceptable for cash equities, with F&O paper trades requiring a Fyers feed?
2. **Market-data feed (#19):** dedicated account, or each user's own connection only?
3. **Analytics modules (G4):** finish or switch off?
4. **Watchlist page (E1):** share Trading's watchlists, or remove the page?
5. **Wallet "plans" (A10):** free sandbox resets, or real plans?
6. **Should Live mode be available at all until batch 3 is done?**

## Acceptance Criteria (for this analysis)

- [x] Every filed issue re-checked against code or a live observation
- [x] Wrong or mis-described issues identified (section 1)
- [x] A proposed fix and effort for each real finding
- [x] Unverified statements marked, with what is needed to verify them
- [ ] Owner decisions (section 6)
- [ ] GitHub issues updated to match (waiting for approval — public content)

## Files to Touch

None in this task. The fix batches will each get their own task folder and `plan.md`.

## Risks & Edge Cases

- NSE's unofficial addresses change without notice; the replacements in C1 were working on 2026-11-20 only.
- Production may differ from the local run in ways listed in section 5.
- Changing timestamp or money column types touches existing data (G5 first).

## Rollback Strategy

Not applicable — no application code was changed.
