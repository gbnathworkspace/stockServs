# Backend Caching Analysis & Improvement Plan

## 📊 Current State Analysis

### ✅ What's Currently Cached

Your backend has **TWO separate caching systems**:

#### 1. **Global Cache Service** (`services/cache.py`)
- **Type**: In-memory, thread-safe cache with TTL
- **Used For**:
  - Stock prices
  - Portfolio data  
  - NSE data (some routes)
  - Sector data
  - Market Pulse data
  - FII/DII activity

**Current TTL Settings:**
```python
TTL_STOCK_LIST = 300 sec     # 5 minutes
TTL_STOCK_PRICE = 30 sec     # 30 seconds
TTL_CANDLE_5M = 60 sec       # 1 minute
TTL_CANDLE_15M = 120 sec     # 2 minutes
TTL_CANDLE_1D = 600 sec      # 10 minutes
TTL_WEEKLY_GAINERS = 300 sec # 5 minutes
TTL_BULK_DEALS = 300 sec     # 5 minutes
TTL_TOP_GAINERS = 300 sec    # 5 minutes
TTL_TOP_LOSERS = 300 sec     # 5 minutes
TTL_FII_DII = 600 sec        # 10 minutes
TTL_SECTOR_DATA = 300 sec    # 5 minutes
TTL_NSE_DATA = 30 sec        # 30 seconds (Market Pulse, etc.)
```

#### 2. **Market Data Cache** (`services/market_data_service.py`)
- **Type**: Simple dictionary-based cache
- **Used For**: YFinance candle data only
- **TTL Settings:**
  ```python
  "5m": 60 sec    # 1 minute
  "15m": 120 sec  # 2 minutes  
  "1d": 600 sec   # 10 minutes
  ```

---

### ❌ What's NOT Cached (This is the Problem!)

These endpoints fetch fresh data **EVERY TIME**:

1. **52-Week High/Low** (`nse_data/high_low.py`) ❌
   - No caching at all
   - Makes fresh NSE API call every request
   - **Solution**: Should use cache with ~5 min TTL

2. **Bulk Deals** (`nse_data/bulk_deals.py`) ❌  
   - No caching visible in route
   - **Solution**: Should use cache with ~5 min TTL

3. **Most Active Stocks** (`nse_data/most_active.py`) ❌
   - No caching visible
   - **Solution**: Should use cache with ~2-5 min TTL

4. **Indices Data** (`nse_data/indices.py`) ❌
   - No caching
   - **Solution**: Should use cache with ~1-2 min TTL

5. **Top Gainers/Losers** (movers) - **Need to verify**
   - May not be using the global cache properly

6. **Weekly Gainers** - Mixed
   - Uses a ThreadPoolExecutor but unclear if cached

---

## 🔍 Why Your Network Requests Are Slow

### Root Causes:

1. **Missing Cache Implementation**
   - Most NSE endpoints don't use the cache system at all
   - Each request = fresh NSE API call
   - NSE has anti-scraping measures → slow responses

2. **No HTTP-Level Caching**
   - No `Cache-Control` headers on responses
   - Browser/client can't cache responses
   - Even static data refetched every time

3. **No Request Deduplication**
   - If 3 users request same data simultaneously
   - Makes 3 separate NSE calls
   - Should: 1st call fetches, others wait for result

4. **No Pre-warming**
   - Cache starts empty on server restart
   - First request after restart = slow
   - Should: Pre-load common data on startup

5. **Serial External API Calls**
   - NSE requires cookie setup → makes 2 requests per endpoint
   - Some routes don't reuse cookies

---

## 🎯 Caching Strategy Guide

### Types of Data → Appropriate TTL

| Data Type | Change Frequency | Recommended TTL | Why |
|-----------|-----------------|-----------------|-----|
| **Real-time Prices** | Every second | 5-30 seconds | Balances freshness vs load |
| **Intraday Data (5m)** | Every 5 min | 1-2 minutes | Near real-time with caching |
| **Daily OHLC** | Once per day | 10-30 minutes | Changes once market closes |
| **52-Week High/Low** | Daily | 5-10 minutes | Daily data, can cache longer |
| **Bulk Deals** | Daily | 5-10 minutes | Updated once per day |
| **Most Active** | ~5-15 min | 2-5 minutes | Reasonable refresh rate |
| **Indices (NIFTY)** | Every minute | 30-60 seconds | Fairly dynamic |
| **FII/DII Activity** | Daily | 10-30 minutes | Updated once per day |
| **Sector Data** | ~15-30 min | 5-10 minutes | Moderate cache |
| **Stock List** | Rarely | 30-60 minutes | Very stable data |
| **User Portfolio** | On-demand | 30-60 seconds | User-specific but not instant |

---

## 🚀 Improvement Plan

### Phase 1: Quick Wins (30 minutes)

1. **Add caching to 52-week endpoints**
   ```python
   # Before: No cache
   data = await fetch_52week_data("gainers")
   
   # After: With cache
   cache_key = "nse:52week_high"
   cached = cache.get(cache_key)
   if cached:
       return cached
   data = await fetch_52week_data("gainers") 
   cache.set(cache_key, data, TTL_NSE_52WEEK)  # 300 sec
   ```

2. **Add caching to most_active, indices**
   - Same pattern as above
   - 2-5 minute TTL

3. **Add HTTP response headers**
   ```python
   @router.get("/52-week-high")
   async def get_52_week_high(response: Response):
       # ... cache logic ...
       response.headers["Cache-Control"] = "public, max-age=300"
       return data
   ```

### Phase 2: Architecture Improvements (1-2 hours)

1. **Request Deduplication**
   - Use `asyncio.Lock` per cache key
   - First request fetches, others wait
   - Prevents "thundering herd"

2. **Cache Pre-warming**
   - On startup, fetch common endpoints
   - Dashboard loads instantly for first user

3. **Cookie Session Reuse**
   - Create persistent httpx client
   - Reuse NSE cookies across requests
   - Reduces API calls by 50%

4. **Centralized Cache Decorator**
   ```python
   @cache_response(key="nse:52week", ttl=300)
   async def get_52_week_high():
       # ... logic ...
   ```

### Phase 3: Advanced (3-4 hours)

1. **Redis Cache** (Production)
   - Replace in-memory with Redis
   - Survives server restarts
   - Shared across multiple server instances

2. **Conditional Requests** (ETags)
   - Return 304 Not Modified when data unchanged
   - Saves bandwidth

3. **Background Refresh**
   - Refresh cache before expiry
   - Users never see stale data
   - "Stale-while-revalidate" pattern

4. **Cache Analytics**
   - Hit/miss ratios
   - Performance metrics
   - Identify optimization opportunities

---

## 📈 Expected Performance Improvements

| Metric | Before | After Phase 1 | After Phase 3 |
|--------|--------|---------------|---------------|
| **52-Week High/Low** | ~2-5 sec | ~50-200ms | ~10-50ms |
| **Most Active** | ~2-5 sec | ~50-200ms | ~10-50ms |
| **Dashboard Load** | ~10-15 sec | ~2-3 sec | ~500ms-1sec |
| **NSE API Calls/min** | ~100+ | ~20-30 | ~5-10 |
| **Server Load** | High | Medium | Low |
| **Cache Hit Rate** | 0% | ~60-70% | ~85-95% |

---

## 🛠 Implementation Checklist

### Immediate (Do Now):
- [ ] Add caching to `nse_data/high_low.py` (52-week)
- [ ] Add caching to `nse_data/most_active.py`
- [ ] Add caching to `nse_data/indices.py`
- [ ] Verify bulk_deals caching
- [ ] Add HTTP Cache-Control headers

### Short-term (This Week):
- [ ] Create cache decorator utility
- [ ] Implement request deduplication
- [ ] Add cache pre-warming on startup
- [ ] Add cache statistics endpoint
- [ ] Test with production load

### Long-term (Next Sprint):
- [ ] Evaluate Redis migration
- [ ] Implement background cache refresh
- [ ] Add cache monitoring/alerting
- [ ] Performance benchmarking
- [ ] Documentation

---

## 🎓 Key Concepts Explained

### 1. **TTL (Time To Live)**
- How long cached data stays valid
- After TTL expires → fetch fresh data
- Balance: Freshness vs Performance

### 2. **Cache Hit vs Miss**
- **Hit**: Data found in cache → fast!
- **Miss**: Data not in cache → fetch from source → slow

### 3. **Cache Invalidation**
- "Clearing" cache when data changes
- Hardest problem in computer science!
- Your approach: TTL-based (time-based expiry)

### 4. **Thundering Herd**
- Problem: 100 requests hit expired cache simultaneously
- Result: 100 API calls to NSE at once
- Solution: Request deduplication (only 1 call, others wait)

### 5. **Stale-While-Revalidate**
- Serve cached (stale) data immediately
- Refresh cache in background
- User never waits
- Always gets data (might be slightly old)

---

## 🔧 Tools & Monitoring

### Cache Statistics:
```bash
GET /cache/stats
{
  "entries": 45,
  "keys": ["nse:52week_high", "price:RELIANCE", ...],
  "hit_rate": "87%",
  "total_requests": 1234,
  "cache_hits": 1073
}
```

### Performance Monitoring:
- Request duration logging (already have!)
- Cache hit/miss logging
- External API call tracking

---

## 💡 Best Practices

1. **Cache Aggressively**
   - Most stock data doesn't change every second
   - Even 30 sec cache = huge improvement

2. **Use Appropriate TTLs**
   - Real-time: 5-30 seconds
   - Daily data: 5-30 minutes
   - Static data: Hours

3. **Handle Cache Failures Gracefully**
   - If cache fails → fetch from source
   - Don't fail request because cache is down

4. **Monitor Cache Performance**
   - Track hit rates
   - Optimize TTLs based on data

5. **Clear Cache on Deployments** (if needed)
   - Or use cache versioning
   - Prevent stale data after code changes

---

## 🎯 Next Steps

**Want me to:**
1. ✅ Implement Phase 1 fixes now (add caching to missing endpoints)?
2. 📊 Create cache statistics dashboard?
3. 🔧 Build cache decorator for cleaner code?
4. 🚀 Set up cache pre-warming?
5. 📝 All of the above?

Just let me know which improvements you want to tackle first!
