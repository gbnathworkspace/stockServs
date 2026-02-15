# 014 — Documentation Cleanup & Pending Task Audit

**Type:** refactor
**Status:** planning

---

## Pending Tasks Overview

### Task A: `docs/CLAUDE.md` — Stale References (HIGH priority)

The project docs reference 7 deleted frontend components and are missing several env vars and routes.

**Deleted components still listed in docs (Lines 159-171):**

| Component | Status | Backend Route Exists? |
|-----------|--------|----------------------|
| `OptionClock.jsx` | DELETED | Yes (`routes/option_clock.py`) |
| `OptionApex.jsx` | DELETED | Yes (`routes/option_apex.py`) |
| `MarketPulse.jsx` | DELETED | Yes (`routes/market_pulse.py`) |
| `InsiderStrategy.jsx` | DELETED | Yes (`routes/insider_strategy.py`) |
| `SectorScope.jsx` | DELETED | No dedicated route |
| `SwingSpectrum.jsx` | DELETED | Yes (`routes/swing_spectrum.py`) |
| `RealTrading.jsx` | DELETED | N/A (replaced by unified Trading) |

**Undocumented env vars (Lines 199-223):**

| Variable | Used In | Status |
|----------|---------|--------|
| `FYERS_PIN` | `services/fyers_service.py` | Missing from docs |
| `DB_SSM_PARAM_NAME` | `services/config_manager.py` | Missing from docs |
| `AWS_REGION` | `services/config_manager.py` | Missing from docs |
| `KITE_API_KEY` | `services/zerodha_service.py` | Missing from docs |
| `KITE_API_SECRET` | `services/zerodha_service.py` | Missing from docs |
| `KITE_REDIRECT_URL` | `services/zerodha_service.py` | Missing from docs |
| `ENABLE_FII_DII_SCHEDULER` | `services/fii_dii_scheduler.py` | Missing from docs |

**Missing from API endpoints table:**

| Route | Prefix | Purpose |
|-------|--------|---------|
| `fyers_market_router` | `/fyers-market` | Fyers market data (prices, quotes) |
| `holdings_router` | `/holdings` | User holdings management |
| `profile_router` | `/profile` | User profile management |
| `market_data_router` | `/market-data` | Market data endpoints |

**Stale feature description (Line 10):**
- Lists "TradeFinder Products: Option Clock, Option Apex..." — these were removed from the UI
- Still says "Virtual Trading (Market Sandbox)" and "Real Trading (Market Connect)" — now unified as "Trading"

---

### Task B: Frontend Structure in docs (MEDIUM priority)

Current `docs/CLAUDE.md` frontend structure tree (Lines 149-173) is outdated:

**What docs say exists:**
```
components/sections/
├── Dashboard.jsx
├── Watchlist.jsx
├── OptionClock.jsx      ← DELETED
├── OptionApex.jsx       ← DELETED
├── MarketPulse.jsx      ← DELETED
├── InsiderStrategy.jsx  ← DELETED
├── SectorScope.jsx      ← DELETED
├── SwingSpectrum.jsx    ← DELETED
└── ...
```

**What actually exists:**
```
components/sections/
├── Dashboard.jsx
├── Documentation.jsx
├── FiiDiiActivity.jsx
├── MarketData.jsx
├── NiftyContributors.jsx
├── OrderHistory.jsx
├── Settings.jsx
├── Wallet.jsx
└── Watchlist.jsx

components/ (top-level)
├── Card.jsx
├── ContributorCard.jsx
├── LoadingOverlay.jsx
├── MarketStatus.jsx
├── MarketStrengthIndicator.jsx
├── OptionChain.jsx
├── PortfolioCard.jsx
├── RefreshControl.jsx
├── SearchAutocomplete.jsx
├── Sidebar.jsx
├── TabCard.jsx
└── VirtualTrading.jsx
```

---

### Task C: Task 013 Completion (LOW priority)

Task 013 (folder reorganization + build workflow rules) is complete. Move it to archive.

---

### Task D: Task 005 — 504 Gateway Timeout Fix (LOW priority, deferred)

Blue-green deployment proposal to avoid 504 timeouts during container restarts. Not urgent — only affects deployment windows.

---

## Acceptance Criteria

- [ ] Remove deleted component references from `docs/CLAUDE.md` frontend structure
- [ ] Update key features list (remove TradeFinder products that no longer have UI)
- [ ] Add all 7 missing env vars to the environment variables section
- [ ] Add missing API routes to the endpoints table
- [ ] Update frontend structure tree to match actual files
- [ ] Move task 013 to archive

---

## Implementation Steps

1. **Update `docs/CLAUDE.md` Key Features (Line 9-14)**
   - Remove TradeFinder products list (no frontend for them)
   - Keep: Trading (unified), Market Data, Watchlist
   - Note backend routes still exist for future re-implementation

2. **Update `docs/CLAUDE.md` Frontend Structure (Lines 149-173)**
   - Replace with actual component listing from the codebase
   - Remove all 6 deleted section components
   - Add VirtualTrading.jsx, OptionChain.jsx, etc.

3. **Update `docs/CLAUDE.md` Environment Variables (Lines 199-223)**
   - Add FYERS_PIN under Fyers Integration
   - Add Zerodha Integration block (KITE_API_KEY, KITE_API_SECRET, KITE_REDIRECT_URL)
   - Add AWS block (DB_SSM_PARAM_NAME, AWS_REGION)
   - Add Scheduler block (ENABLE_FII_DII_SCHEDULER)

4. **Update `docs/CLAUDE.md` API Endpoints table (Lines 128-141)**
   - Add `/fyers-market`, `/holdings`, `/profile`, `/market-data`

5. **Move task 013 to archive**

---

## Files to Touch

| File | Reason |
|------|--------|
| `docs/CLAUDE.md` | Update features, frontend structure, env vars, API routes |
| `.workflows/tasks/archive/013-*` | Move completed task 013 |

---

## Risks & Edge Cases

- Backend routes for deleted components (option_clock, option_apex, etc.) still exist and are registered in `main.py`. The docs should note these as "backend-only / API-only" rather than pretending they don't exist.
- Zerodha integration is partially implemented (env vars exist but may not be active). Document as optional.

---

## Rollback Strategy

- Documentation-only changes — `git checkout docs/CLAUDE.md` reverts everything
