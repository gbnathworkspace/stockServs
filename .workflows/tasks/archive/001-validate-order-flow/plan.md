# Task 001: Validate Order Placement Flow

- **Type:** api-integration
- **Status:** planning
- **Created:** 2026-02-14

---

## Problem Statement

Validate the full order placement flow for stocks and options:
1. Where orders are stored after placement
2. Whether costs (cost basis, total value, P&L) are reflected correctly
3. Whether recent changes (Tasks 006, 008, 011) are complete and correct

---

## Architecture Summary

### Order Flow: Two Paths

| Path | Route | Service | Storage |
|------|-------|---------|---------|
| **Virtual (Paper)** | `POST /portfolio/trade` | `portfolio_service.execute_trade()` (L235-378) | `virtual_orders`, `virtual_holdings`, `virtual_wallets` |
| **Live (Fyers)** | `POST /fyers/order` | `fyers_service.place_fyers_order()` (L197-207) | Fyers broker-side only — **NOT stored locally** |

### Storage Tables (`database/models.py`)

| Table | Key Fields | Notes |
|-------|------------|-------|
| `virtual_orders` (L81-95) | symbol, side, qty, price, total_value, order_type, status | Order audit log |
| `virtual_holdings` (L68-79) | symbol, quantity, average_price | Running positions |
| `virtual_wallets` (L57-66) | balance (default 100,000) | Cash tracking |
| `fyers_tokens` (L23-32) | access_token, refresh_token, expires_at | Broker auth |

### Cost Basis Method

- **Weighted average**: `new_avg = (old_avg * old_qty + exec_price * new_qty) / total_qty`
- On SELL: average_price unchanged, only quantity reduced
- P&L delegated to frontend: `(LTP - average_price) * quantity`

---

## Recent Changes Already Made (Context)

### Task 006 — F&O Trading Flow Fix (Done)
- Fixed double-prefix bug in `convert_nse_to_fyers()` (fyers_service.py L372-374)
- F&O symbols already in `NSE:` format no longer get double-prefixed
- Added `enrichWithFyersPrices()` in frontend for live F&O price enrichment

### Task 008 — TradeModal Buy Flow for Options (Done)
- Option chain buy flow now parses symbols, shows lot sizes, fetches live prices
- TradeModal rewritten with proper F&O support
- Lot size calculation: NIFTY=75, BANKNIFTY=15, etc.

### Task 011 — Portfolio/Orders Sync (Done)
- Added `_sync_missing_orders()` (portfolio_service.py L178-207)
- Creates retroactive BUY orders for holdings without order records
- Ensures Orders tab matches Portfolio tab

---

## Validation Findings

### A. Virtual Trading — Stocks: WORKING with issues

| # | Check | Status | Details |
|---|-------|--------|---------|
| A1 | BUY deducts wallet by `price * qty` | **OK** | portfolio_service.py L311: `wallet.balance -= total_value` |
| A2 | BUY creates/updates holding with avg_price | **OK** | L313-325: Creates new or updates existing |
| A3 | Weighted average recalculation | **OK** | L314-317: `total_cost / total_qty` formula correct |
| A4 | SELL credits wallet | **OK** | L332: `wallet.balance += total_value` |
| A5 | SELL reduces qty, deletes if 0 | **OK** | L334-335: `db.delete(holding)` when qty=0 |
| A6 | SELL doesn't change avg_price | **OK** | avg_price not touched on SELL path |
| A7 | Order log correct | **OK** | L340-350: VirtualOrder created with all fields |
| A8 | LIMIT BUY validation | **ISSUE** | All LIMIT orders fill immediately (L256-286) — no PENDING state |
| A9 | LIMIT SELL validation | **ISSUE** | Same — always FILLED, never PENDING |
| A10 | Insufficient balance error | **OK** | L298-302: HTTPException raised |
| A11 | Insufficient quantity error | **OK** | L328-329: HTTPException raised |

### B. Virtual Trading — Options (F&O): WORKING with gaps

| # | Check | Status | Details |
|---|-------|--------|---------|
| B1 | F&O symbol detection | **OK** | L33-42: Detects `NSE:...CE/PE` and plain formats |
| B2 | F&O uses provided price | **OK** | L245: `payload.price if is_fno` |
| B3 | F&O holdings tracked | **OK** | Same model as stocks |
| B4 | F&O P&L calculation | **PARTIAL** | Frontend enriches via Fyers quotes; fails if Fyers disconnected |

### C. Live Trading (Fyers): WORKING but isolated

| # | Check | Status | Details |
|---|-------|--------|---------|
| C1 | Payload format correct | **OK** | Frontend sends Fyers format (side=1/-1, type=1/2, productType) |
| C2 | Response returned | **OK** | fyers.py L257: Returns raw Fyers response |
| C3 | No local order storage | **GAP** | Orders only on Fyers side — no local history |
| C4 | No response validation | **GAP** | Doesn't check `response["s"] == "ok"` |

### D. Cost Reflection: WORKING with delegation

| # | Check | Status | Details |
|---|-------|--------|---------|
| D1 | `total_invested` correct | **OK** | L165: `sum(avg_price * qty)` |
| D2 | `holdings_value` via backend | **SKIPPED** | L169: Returns `None` — delegated to frontend |
| D3 | `total_pnl` via backend | **SKIPPED** | L171: Returns `None` — delegated to frontend |
| D4 | Order history sorted | **OK** | L218: `order_by(created_at.desc())` |
| D5 | Frontend displays costs | **OK** | PortfolioView.jsx L47-64 calculates from LTP |

### E. Edge Cases: Issues found

| # | Check | Status | Details |
|---|-------|--------|---------|
| E1 | yfinance failure | **PARTIAL** | Returns None, falls back to payload.price; but no user feedback |
| E2 | Concurrent orders | **RISK** | No DB locking — race condition on avg_price and wallet |
| E3 | Input validation | **OK** | Schema validates qty>0, price>0 |
| E4 | Large orders | **OK** | Wallet check prevents overspend |

---

## Bugs & Issues Found (Prioritized)

### P0 — MARKET order trusts client price
- **File:** `portfolio_service.py` L289
- **Issue:** `execution_price = _round_price(payload.price)` — uses client-provided price for MARKET orders
- **Should:** Use `current_ltp` when available; only fall back to `payload.price` for F&O
- **Impact:** User could manipulate execution price via API

### P1 — All LIMIT orders execute immediately
- **File:** `portfolio_service.py` L256-286
- **Issue:** Every LIMIT order is set to `status = "FILLED"` — no PENDING state
- **Impact:** Unrealistic trading simulation; can't test limit order strategies

### P1 — No realized P&L tracking
- **File:** `portfolio_service.py` L327-336
- **Issue:** SELL doesn't calculate or store realized profit/loss
- **Impact:** No way to see "I made ₹500 on this RELIANCE trade"

### P2 — `_sync_missing_orders()` runs on EVERY order query
- **File:** `portfolio_service.py` L213
- **Issue:** DB transaction on every `GET /portfolio/orders` call
- **Fix:** Run once on app startup or on first portfolio load, not every query

### P2 — Fyers order response not validated
- **File:** `routes/fyers.py` L244-258
- **Issue:** Returns raw Fyers response without checking success/failure
- **Fix:** Check `response.get("s") == "ok"` before returning success

### P3 — No F&O expiry tracking
- **File:** `database/models.py` L68-79
- **Issue:** `VirtualHolding` has no expiry_date field for options
- **Impact:** Options that expire remain as zombie holdings

### P3 — Float precision for wallet
- **File:** `database/models.py` L62
- **Issue:** `balance = Column(Float)` — float arithmetic drift over many trades
- **Fix:** Use `Numeric(12, 2)` or integer paise representation

---

## Recommended Fixes (Implementation Steps)

### Step 1: Fix MARKET order price source (P0)
```
portfolio_service.py L287-290:
- MARKET order should use current_ltp when available
- Only fall back to payload.price for F&O or when LTP fetch fails
```

### Step 2: Fix LIMIT order simulation (P1)
```
portfolio_service.py L256-286:
- If BUY LIMIT price < market: set status=PENDING (don't execute)
- If SELL LIMIT price > market: set status=PENDING
- Only FILL when condition is met
- Add background job or next-request check for pending orders
```

### Step 3: Add realized P&L on SELL (P1)
```
portfolio_service.py SELL path:
- Calculate: realized_pnl = (execution_price - average_price) * quantity
- Store in VirtualOrder record (new field or separate table)
```

### Step 4: Optimize _sync_missing_orders (P2)
```
portfolio_service.py L213:
- Move to a one-time migration or startup task
- Remove from hot path of get_order_history()
```

### Step 5: Validate Fyers order response (P2)
```
routes/fyers.py L244-258:
- Check response["s"] == "ok"
- Return proper error to frontend if order failed
```

### Step 6: Add expiry field for F&O (P3)
```
database/models.py VirtualHolding:
- Add expiry_date = Column(Date, nullable=True)
- Parse expiry from F&O symbol on order placement
```

---

## Files to Touch (if fixing)

| File | Changes |
|------|---------|
| `services/portfolio_service.py` | Fix MARKET price source, LIMIT simulation, realized P&L, sync optimization |
| `routes/fyers.py` | Validate Fyers response |
| `database/models.py` | Add expiry_date to VirtualHolding, consider Numeric for wallet |
| `schemas/portfolio.py` | Add realized_pnl field to OrderInfo |
| `frontend/src/components/trading/PortfolioView.jsx` | Display realized P&L if added |

---

## Risks & Rollback

- **MARKET price fix**: Low risk — adds a preference for server-fetched price
- **LIMIT simulation**: Medium risk — changes trade behavior, needs frontend update for PENDING state
- **Realized P&L**: Low risk — additive, doesn't break existing flow
- **Schema changes**: Medium risk — needs DB migration for new columns

**Rollback:** All changes scoped to specific functions. Revert individual commits if issues arise.
