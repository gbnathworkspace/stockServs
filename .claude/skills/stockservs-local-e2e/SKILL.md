---
name: stockservs-local-e2e
description: Use when running stockServs locally, smoke-testing or end-to-end testing it (signup, sandbox trades, portfolio, market data), demoing it on a laptop, or connecting a Fyers account locally to check live prices or the option chain.
---

# stockServs: run and end-to-end test locally

## Hard rules (these hold under deadline pressure too)

1. **Database = a throwaway SQLite file, always.** The committed `.env` `DATABASE_URL` is the
   hosted Neon Postgres the deployed app uses. Startup runs `create_all`, signup/trades/error
   logs write rows, and `option_clock_service.get_system_access_token()` hands the newest Fyers
   token in the DB to every user. A demo or "quick check" is not an exception.
2. **Secrets go in as shell env vars at launch, never into a file in the repo.** `.env` is tracked
   in git — editing it with a Fyers secret is one `git commit -a` from a leak.
3. **No real-money orders.** Never click "Fyers Live" in the trade window, the Live mode trade
   flow, or call `POST /fyers/order*`. Sandbox trades (`POST /portfolio/trade`) are virtual.

## 1. Start the app (one origin: port 8000)

Git Bash, from the repo root. Put the venv and DB outside the repo (CLAUDE.md temp-file rule).

```bash
S="$(cygpath -m "$TEMP")/claude/stockservs-e2e"; mkdir -p "$S"
python -m venv "$S/venv" && "$S/venv/Scripts/python" -m pip install -q -r requirements.txt
(cd frontend && npm ci --no-audit --no-fund && npm run build)   # serves at /app on :8000
DATABASE_URL="sqlite:///$S/e2e.db" JWT_SECRET=local-e2e PYTHONUNBUFFERED=1 \
  "$S/venv/Scripts/python" -m uvicorn main:app --host 127.0.0.1 --port 8000 > "$S/server.log" 2>&1 &
```

- Env vars beat `.env` (`load_dotenv()` doesn't override), so no file edits are needed.
- Open **`http://127.0.0.1:8000/`** (not `/login`, which 404s server-side; not Vite :5173 — the
  Fyers callback lands on :8000 and localStorage is per-origin). Don't mix `localhost`/`127.0.0.1`.
- Ready check: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health` → `200`.
- Startup schedulers call NSE/yfinance; their errors in the log are noise, not a failed start.

## 2. API smoke test (exact formats)

```bash
B=http://127.0.0.1:8000; E="e2e$RANDOM@example.com"; P='E2eTest#2026'
curl -s -X POST $B/auth/signup -H 'Content-Type: application/json' \
  -d "{\"email\":\"$E\",\"password\":\"$P\",\"display_name\":\"E2E\"}"
TOK=$(curl -s -X POST $B/auth/login --data-urlencode "username=$E" --data-urlencode "password=$P" \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")   # FORM fields, not JSON
H="Authorization: Bearer $TOK"
curl -s $B/profile/me -H "$H"
curl -s $B/portfolio/wallet -H "$H"
curl -s -X POST $B/portfolio/trade -H "$H" -H 'Content-Type: application/json' \
  -d '{"symbol":"RELIANCE","side":"BUY","quantity":1,"price":1400}'
curl -s $B/portfolio/summary -H "$H"; curl -s "$B/portfolio/orders?limit=20" -H "$H"
curl -s -o /dev/null -w "%{http_code}\n" $B/portfolio/summary   # 401 without token
```

## 3. UI walk-through (screens as of v2.1.0)

Sidebar: **Dashboard · Trading · Market Data** (Top Gainers, Top Losers, Nifty Contributors,
FII/DII Activity, Weekly Movers, Bulk Deals) **· Watchlist · Platform Guide · Settings** (Profile,
Preferences). Trading has a **Sandbox/Live** switch and tabs **Trade · Portfolio · Orders · Option
Chain · Wallet**. Check each screen, plus: wrong-password login, signup validation, light theme,
375px width, logout.

Reading results correctly:
- Without Fyers, prices show ₹0.00 and the trade window wants a manual price — expected.
- **Bulk Deals may be fake:** `nse_data/bulk_deals.py` returns random mock deals when NSE blocks.
- Weekly Movers takes ~8–10 s; wait ≥15 s before calling it stuck.
- NSE may 301 `nseindia.com/api` → `nseindia.in` (404): gainers/losers/contributors then 500.

## 4. Connect Fyers locally (live prices, option chain)

The repo `.env` `FYERS_REDIRECT_URI` is the **production EC2 host** — never run OAuth with it from
local (the callback would go to prod). Use a **separate Fyers dev app** (myapi.fyers.in → Create
App; webhook: leave empty) with redirect `https://127.0.0.1:8000/` or `http://127.0.0.1:8000/`.
Ask the user for the App ID; they type the secret into the launch command themselves.

If the registered redirect is **https**, serve over https with a throwaway cert:

```bash
MSYS_NO_PATHCONV=1 openssl req -x509 -newkey rsa:2048 -nodes -days 2 -subj "/CN=127.0.0.1" \
  -addext "subjectAltName=IP:127.0.0.1" -keyout "$S/key.pem" -out "$S/cert.pem"
read -rs FYERS_SECRET_KEY        # user types it: not echoed, not in shell history
DATABASE_URL="sqlite:///$S/e2e.db" JWT_SECRET=local-e2e PYTHONUNBUFFERED=1 \
FYERS_CLIENT_ID=<app id> FYERS_SECRET_KEY="$FYERS_SECRET_KEY" FYERS_REDIRECT_URI=https://127.0.0.1:8000/ \
  "$S/venv/Scripts/python" -m uvicorn main:app --host 127.0.0.1 --port 8000 \
  --ssl-keyfile "$S/key.pem" --ssl-certfile "$S/cert.pem" > "$S/server.log" 2>&1 &
```

In https mode use `B=https://127.0.0.1:8000` and `curl -sk` for every API call above.

`FYERS_REDIRECT_URI` must equal the registered URL exactly (scheme, host, trailing `/`). Verify
before the browser step: `GET /fyers/auth-url` (with `$H`) → its `client_id`/`redirect_uri`.

Browser flow: open `https://127.0.0.1:8000/` → **the user** clicks past the certificate warning
(Advanced → Continue/Proceed; automation can't and shouldn't) → sign in → Settings → Profile →
Fyers **Connect** → **the user** logs in to Fyers and ticks the terms box (it grants order
placement — their decision) → lands back on `/app/?fyers_connected=true`.

| Symptom | Fix |
|---|---|
| "invalid auth token" on the Fyers consent page | Stale Fyers web session: user logs out/in at myapi.fyers.in (or uses an InPrivate window), retry Connect |
| `/app/?fyers_error=...` | Read `[FYERS_CALLBACK]` lines in `server.log` |
| SSL error after Fyers login | Server not on https while redirect is https |
| No callback in log at all | Redirect mismatch or user never finished consent |

Confirm: `GET /fyers/status` → `"connected": true`. Then check `/fyers/market/major-indices`,
`/fyers/market/quotes?symbols=RELIANCE,TCS`, `/fyers/market/option-chain/NIFTY`.
- Option chain with `"source": "nse_fallback"` is **not** a Fyers pass.
- Outside 09:15–15:30 IST, `spotSource` is `prev_close`; judge "live" values in market hours.
- Sanity-check values, don't just check 200s: OI non-zero across strikes, PCR ≠ 0, bid ≤ ask,
  candle spacing matches the requested resolution.

## 5. Clean up

Stop uvicorn (`Get-NetTCPConnection -LocalPort 8000` → `Stop-Process`), delete `$S` (it holds the
Fyers token and cert key), `unset FYERS_SECRET_KEY`, close
browser tabs you opened, and remind the user they can revoke the Fyers dev app at myapi.fyers.in.
