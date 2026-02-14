# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Stock Services (stockServs)** - A full-stack stock market analysis and paper trading platform for the Indian stock market (NSE/BSE). Built with FastAPI backend and React frontend, featuring real-time market data, options analysis, and virtual trading capabilities.

### Key Features
- **Trading**: Unified trading hub with Sandbox (paper trading) and Live (Fyers broker) modes
- **Market Data**: Top gainers/losers, Nifty contributors, FII/DII activity, weekly movers, bulk deals
- **Option Chain**: Real-time options data with strike selection
- **Watchlist Management**: Up to 15 watchlists per user
- **Backend Analytics APIs** (API-only, no frontend UI): Option Clock, Option Apex, Market Pulse, Insider Strategy, Swing Spectrum

## Architecture

```
stockServs/
├── main.py                 # FastAPI app entry point, router registration
├── routes/                 # API route handlers
├── services/              # Business logic and external API integrations
├── database/              # SQLAlchemy models and connection
├── schemas/               # Pydantic request/response schemas
├── nse_data/              # NSE market data fetchers (movers, sectors, FII/DII)
├── data/symbols/          # Static symbol data files
├── migrations/            # SQL migration scripts
├── frontend/              # React SPA (Vite + React 18)
├── static/                # Static files and built React app
└── scripts/               # Utility scripts
```

### Backend Stack
- **Framework**: FastAPI 0.115.0
- **Database**: PostgreSQL with SQLAlchemy 2.0 ORM
- **Auth**: JWT tokens (python-jose), bcrypt for password hashing
- **External APIs**: Fyers API v3 (broker), NSE India, yfinance
- **Background Jobs**: APScheduler for data refresh
- **Cache**: In-memory TTL cache (services/cache.py)

### Frontend Stack
- **Framework**: React 18.3 with Vite 5.4
- **Routing**: react-router-dom 7.x
- **Charts**: lightweight-charts 4.x
- **Icons**: lucide-react
- **Styling**: CSS modules (no Tailwind)

## Development Commands

### Backend Setup & Run
```bash
# Install dependencies
pip install -r requirements.txt

# Run development server (auto-reload)
uvicorn main:app --reload

# Run production server
uvicorn main:app --host 0.0.0.0 --port 8000

# Enable SQL query logging
DEBUG_SQL=true uvicorn main:app --reload
```

### Frontend Setup & Run
```bash
cd frontend

# Install dependencies
npm install

# Run dev server (accessible on network)
npm run dev

# Build for production (outputs to ../static/app)
npm run build
```

### Docker
```bash
# Build image (includes frontend build)
docker build -t stock_servs .

# Run container
docker run -p 8000:8000 stock_servs
```

## Database Schema

Key models defined in `database/models.py`:

| Model | Purpose |
|-------|---------|
| `User` | Base user account |
| `LocalCredential` | Email/password or Google OAuth credentials |
| `UserProfile` | Display name, avatar, preferences |
| `FyersToken` | Fyers broker access tokens |
| `ZerodhaToken` | Zerodha broker tokens |
| `VirtualWallet` | Paper trading balance (starts at 1,00,000) |
| `VirtualHolding` | Paper trading stock positions |
| `VirtualOrder` | Paper trading order history |
| `Watchlist` | User watchlists (max 15) |
| `WatchlistStock` | Stocks within watchlists |
| `OptionClockSnapshot` | 15-minute OI snapshots for options analysis |
| `MarketPulseSnapshot` | Volume surge and delivery data |
| `SwingSpectrumBreakout` | 52-week high/low breakouts |
| `InsiderStrategyPick` | Composite-scored stock picks |
| `OptionApexCandle` | Real-time option candle data |
| `FiiDiiActivity` | FII/DII daily activity |
| `ApiLog` / `ErrorLog` | Request and error logging |

### Database Connection
- Uses `DATABASE_URL` env var or AWS Parameter Store via `services/config_manager.py`
- Connection pooling: 10 base + 20 overflow connections
- Pool pre-ping enabled for connection health checks

## API Endpoints

### Authentication (`/auth`)
- `POST /auth/signup` - Email/password registration
- `POST /auth/login` - OAuth2 password flow login
- `POST /auth/google` - Google OAuth sign-in
- `GET /auth/me` - Get current user

### Protected Routes (require JWT Bearer token)
All routes below require `Authorization: Bearer <token>` header.

| Prefix | Purpose |
|--------|---------|
| `/nse` | NSE market data |
| `/portfolio` | Virtual portfolio management |
| `/holdings` | User holdings management |
| `/watchlist` | Watchlist CRUD |
| `/market-data` | Market data endpoints |
| `/market-pulse` | Volume surge analysis (API only) |
| `/swing-spectrum` | Breakout detection (API only) |
| `/insider-strategy` | Composite stock picks (API only) |
| `/option-apex` | Options candle data (API only) |
| `/option-clock` | OI-based direction signals (API only) |
| `/sectors` | Sector heatmaps and stocks |
| `/fyers` | Fyers broker integration (callback is public) |
| `/fyers-market` | Fyers market data (prices, quotes) |
| `/profile` | User profile management |
| `/logs` | API logs and error logs |

### System Endpoints
- `GET /` - Redirects to React app or Fyers callback
- `GET /health` - Health check
- `GET /scheduler/status` - Background data scheduler status
- `POST /scheduler/fetch` - Manual data refresh trigger
- `GET /debug/static` - Debug static file paths

## Frontend Structure

```
frontend/src/
├── App.jsx                 # Main app with routing logic
├── main.jsx               # React entry point
├── styles.css             # Global styles
├── contexts/              # Theme, Loading, Toast contexts
├── hooks/                 # useAutoRefresh, useOnlineStatus
├── lib/api.js             # API client with retry + 401 session expiry handling
├── pages/                 # Login, Signup pages
├── components/
│   ├── sections/          # Main view components
│   │   ├── Dashboard.jsx
│   │   ├── Documentation.jsx
│   │   ├── FiiDiiActivity.jsx
│   │   ├── MarketData.jsx
│   │   ├── NiftyContributors.jsx
│   │   ├── OrderHistory.jsx
│   │   ├── Settings.jsx
│   │   ├── Wallet.jsx
│   │   └── Watchlist.jsx
│   ├── VirtualTrading.jsx  # Unified trading (Sandbox + Live mode toggle)
│   ├── OptionChain.jsx     # Options chain viewer
│   ├── Sidebar.jsx         # Navigation sidebar
│   ├── SearchAutocomplete.jsx
│   ├── RefreshControl.jsx
│   ├── LoadingOverlay.jsx
│   └── *.jsx              # Card components and shared UI
└── utils/                 # Utility functions
```

### API Client Patterns (`lib/api.js`)
- `authApi(url, options)` - Authenticated fetch with Bearer token
- `authApiWithRetry(url, options)` - With exponential backoff retry
- `fastAuthApi(url, options)` - Request deduplication for auto-refresh
- `batchApi(urls)` - Parallel API calls

## Key Conventions

### Backend
1. **Route Protection**: Use `dependencies=[Depends(get_current_user)]` for protected routes
2. **Error Logging**: Non-2xx responses auto-logged to `error_logs` table via middleware
3. **Caching**: Use `services/cache.py` with TTL constants for NSE data
4. **Response Format**: Return Pydantic models or dicts; FastAPI handles JSON serialization

### Frontend
1. **Section Navigation**: Use `activeSection` state with dot notation (e.g., `market.gainers`, `settings.profile`)
2. **API Calls**: Always use `authApi` or `authApiWithRetry` from `lib/api.js`
3. **Styling**: Use CSS classes, no inline styles or Tailwind
4. **Icons**: Import from `lucide-react` package

### Code Style
- Python: No type hints required, but SQLAlchemy models use type annotations
- JavaScript: ES modules, async/await preferred
- No semicolons in JS (project convention varies - check context)

## Environment Variables

Required in `.env` (see `.env.example`):

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# AWS Parameter Store (alternative to DATABASE_URL)
DB_SSM_PARAM_NAME=/stockservs/db-url
AWS_REGION=ap-south-1

# Authentication
JWT_SECRET=your-secret-key

# Fyers Integration (optional)
FYERS_CLIENT_ID=xxx
FYERS_SECRET_KEY=xxx
FYERS_REDIRECT_URI=http://localhost:8000/fyers/callback
FYERS_PIN=xxxx

# Zerodha Integration (optional)
KITE_API_KEY=xxx
KITE_API_SECRET=xxx
KITE_REDIRECT_URL=http://localhost:8000/zerodha/callback

# Google OAuth (optional)
GOOGLE_CLIENT_ID=xxx

# CORS (production)
ALLOWED_ORIGINS=https://yourdomain.com

# Scheduler
ENABLE_FII_DII_SCHEDULER=true

# Debug
DEBUG_SQL=false
```

## Deployment

### GitHub Actions (`.github/workflows/deploy.yml`)
- Triggers on push to `main` branch
- Builds Docker image and pushes to Docker Hub
- SSH deploys to EC2 instance

### Production Notes
- React app served from `/static/app/` via FastAPI static files
- CORS configured via `ALLOWED_ORIGINS` env var
- Background schedulers start on app startup (`on_event("startup")`)

## Testing

Currently no automated test suite. Manual testing via:
- Postman collection: `stock_servs.postman_collection.json`
- Test scripts: `run_direct_test.py`, `run_direct_test_v2.py`

## Common Tasks

### Adding a New API Route
1. Create route file in `routes/` (e.g., `routes/new_feature.py`)
2. Create service file in `services/` for business logic
3. Import and register router in `main.py` with appropriate dependencies
4. Add caching if fetching external data frequently

### Adding a New Frontend Section
1. Create component in `frontend/src/components/sections/`
2. Add case to `renderContent()` switch in `App.jsx`
3. Add to `getSectionTitle()` titles mapping
4. Add navigation item in `Sidebar.jsx`

### Database Changes
1. Update model in `database/models.py`
2. Create migration SQL in `migrations/`
3. Run migration via `migrations/run_migration.py` or direct SQL

## Troubleshooting

- **CORS errors**: Check `ALLOWED_ORIGINS` env var matches frontend origin
- **401 Unauthorized**: Token expired or missing; check localStorage `access_token`
- **Slow NSE data**: NSE API can be slow; timeouts set to 30s in frontend
- **Cache issues**: Use `/scheduler/fetch` to force refresh or clear cache in `services/cache.py`
