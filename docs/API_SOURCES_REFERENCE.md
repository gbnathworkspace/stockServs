# External API Sources - Reference Guide

This document explains all the external APIs and data sources used by the Stock Services backend.

---

## 📡 Data Sources Overview

### 1. **NSE India API** (Primary Source)
**Base**: `https://www.nseindia.com/api/`

The National Stock Exchange provides most of our market data through their public API endpoints.

#### Key NSE Endpoints:

| Endpoint | Purpose | Data Returned |
|----------|---------|---------------|
| `/allIndices` | All market indices | NIFTY 50, BANK NIFTY, sector indices with OHLC data |
| `/equity-stockIndices?index=NIFTY%2050` | Index constituents | Stocks in an index with prices, volume, changes |
| `/live-analysis-most-active-securities` | Most active stocks | Stocks sorted by value/volume |
| `/live-analysis-variations?index=gainers` | 52-week high/low | Stocks near 52-week extremes |
| `/fiidiiTradeReact` | FII/DII activity | Institutional buy/sell data |
| `/snapshot/capital-market/bulk-block-deals` | Bulk & block deals | Large institutional trades |

**Authentication**: None (public API with anti-scraping measures)

**Rate Limiting**: Heavy scraping protection - requires:
- Cookie warming (visit homepage first)
- Proper headers (User-Agent, Referer)
- Delays between requests (0.3-1 second)

**Update Frequency**:
- Real-time data: Every 1-5 minutes during market hours
- EOD data: Once per day after market close

---

### 2. **NSE Archives** (Historical Data)
**Base**: `https://archives.nseindia.com/`

#### Endpoint:
- `/content/equities/EQUITY_L.csv` - Complete list of all NSE equities

**Update Frequency**: Daily (updated overnight)

**Format**: CSV file

**Use Case**: Fallback when live API fails, complete stock list

---

### 3. **YFinance API** (Charts & Historical Data)
**Library**: `yfinance` Python package

**Symbol Format**: `{SYMBOL}.NS` (e.g., `RELIANCE.NS`)

**Data Fetched**:
- Candlestick data (5m, 15m, 1d intervals)
- Historical OHLCV (Open, High, Low, Close, Volume)
- Indicators (SMA, EMA, RSI) - calculated from OHLC

**Advantages**:
- ✅ Reliable and fast
- ✅ No authentication needed
- ✅ Rich historical data
- ✅ Works even when NSE API blocks us

**Update Frequency**:
- Intraday: Real-time (with 15-min delay for free tier)
- Daily: Once per day after market close

**Caching**: Built-in caching in `services/market_data_service.py`
- 5m candles: 60 sec cache
- 15m candles: 120 sec cache
- 1d candles: 600 sec cache

---

### 4. **Fyers API** (Broker Integration)
**Base**: `https://api.fyers.in/`

**Authentication**: OAuth 2.0 (requires user authorization)

**Data Fetched**:
- User's live positions
- Holdings
- Order book
- Account balance

**Update Frequency**:
- Positions/Orders: Real-time (every 5-30 seconds)
- Holdings: Daily/On change

**User-Specific**: Yes (each user has their own Fyers account)

**Status**: Optional integration - only used if user connects their Fyers account

---

### 5. **Database** (Internal Storage)
**Type**: PostgreSQL/SQLite

**Stored Data**:
- User accounts and profiles
- Portfolios (virtual trading)
- Watchlists
- Trade history
- FII/DII historical data
- Market Pulse snapshots
- Bulk deal records

**Update Frequency**: Real-time on user actions

---

## 🔐 API Authentication Requirements

| Source | Auth Required? | Type | Notes |
|--------|---------------|------|-------|
| NSE India | ❌ No | Public | Uses cookie warming & headers |
| NSE Archives | ❌ No | Public | Simple CSV download |
| YFinance | ❌ No | Public | Free tier with 15-min delay |
| Fyers | ✅ Yes | OAuth 2.0 | Only if user connects broker |
| Database | ✅ Yes | JWT | User authentication required |

---

## 🚧 Anti-Scraping Measures

### NSE India Protections:
1. **Cookie Requirement**: Must visit homepage before API calls
2. **Header Validation**: Checks `User-Agent`, `Referer`, `Accept`
3. **Rate Limiting**: Blocks rapid consecutive requests
4. **IP Throttling**: May block if too many requests from same IP

### Our Workarounds:
```python
# 1. Cookie warming
await client.get("https://www.nseindia.com", headers=home_headers)
await asyncio.sleep(0.3-1.0)  # Delay

# 2. Proper headers
headers = {
    "User-Agent": "Mozilla/5.0 ...",
    "Referer": "https://www.nseindia.com/",
    "Accept": "*/*",
    # ... more realistic browser headers
}

# 3. Caching (reduces API calls)
cache.set(key, data, TTL_300)  # Cache for 5 minutes
```

---

## 📊 Data Flow Diagram

```
User Request
    ↓
Backend Endpoint (/nse/indices)
    ↓
Cache Check
    ↓
    ├─ Cache Hit → Return cached data (< 50ms)
    │
    └─ Cache Miss
        ↓
    External API Call
        ↓
        ├─ NSE India API
        ├─ YFinance API
        ├─ Fyers API
        └─ Database Query
            ↓
        Store in Cache (TTL-based)
            ↓
        Return to User
```

---

## 🎯 Key Insights

### 1. **Most Data is from NSE**
- 80% of market data comes from NSE India API
- NSE data is **SHARED** across all users
- Heavy caching is crucial for NSE endpoints

### 2. **YFinance for Charts**
- All candlestick charts use YFinance
- More reliable than NSE for historical data
- Also **SHARED** across users

### 3. **Database for User Data**
- User portfolios, watchlists, trades
- **USER-SPECIFIC** - not shared
- Database queries are fast but still benefit from light caching

### 4. **Fyers for Real Trading**
- Optional - only if user connects broker
- **USER-SPECIFIC** and real-time
- Rate limits apply per Fyers account

---

## 🔧 Troubleshooting

### NSE API Returns 403 Forbidden:
- **Cause**: Anti-scraping protection triggered
- **Fix**: 
  1. Check cookie warming is working
  2. Verify headers are correct
  3. Add longer delays between requests
  4. Use mock/fallback data temporarily

### YFinance Returns No Data:
- **Cause**: Invalid symbol or network issue
- **Fix**: 
  1. Ensure symbol format is `{SYMBOL}.NS`
  2. Check if stock is delisted
  3. Use NSE API as fallback

### Database Query Slow:
- **Cause**: Missing indexes or large dataset
- **Fix**:
  1. Add database indexes on frequently queried columns
  2. Use pagination for large result sets
  3. Cache query results

---

## 📝 Summary

| Data Type | Primary Source | Fallback | Shared? | Cache Priority |
|-----------|---------------|----------|---------|----------------|
| Indices | NSE API | None | ✅ Yes | **CRITICAL** |
| Stock Prices | YFinance | NSE API | ✅ Yes | High |
| Market Movers | NSE API | None | ✅ Yes | **CRITICAL** |
| Charts | YFinance | None | ✅ Yes | High |
| FII/DII | NSE API | Database | ✅ Yes | Low |
| Bulk Deals | NSE API | Mock Data | ✅ Yes | Medium |
| Sectors | NSE API | None | ✅ Yes | Medium |
| User Portfolio | Database | None | ❌ No | Medium |
| Broker Data | Fyers API | None | ❌ No | High |

**Key Takeaway**: Focus caching efforts on **NSE API endpoints** that are **SHARED** across users - this is where you get 10-100× performance gains!

---

## 🔗 Useful Links

- [NSE India Market Data](https://www.nseindia.com/market-data)
- [YFinance Documentation](https://pypi.org/project/yfinance/)
- [Fyers API Docs](https://fyers-api.readthedocs.io/)

---

**Last Updated**: 2025-12-27
