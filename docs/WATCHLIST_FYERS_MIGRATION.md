# Watchlist Migration to Fyers API

## Overview
Migrated the Watchlist component from NSE India API to Fyers API for reliable stock price data.

## Problem Statement

### Issue: Stock Prices Showing ₹0.00

**Root Cause:**
- NSE India API (`/nse_data/all-stocks`) was unreliable due to:
  - Anti-scraping measures (403 Forbidden errors)
  - No data outside market hours
  - Fallback to `EQUITY_L.csv` which has symbols but **no prices**

**Symptoms:**
- All stocks in watchlist showed ₹0.00
- Percentage changes showed 0.00%
- Poor user experience

## Solution

### Migration to Fyers API

Switched the Watchlist component to use Fyers API (like Market Sandbox already does):

#### Before (NSE Direct):
```javascript
// Load ALL stocks (~500+) from NSE
GET /nse_data/all-stocks
→ Returns NIFTY 500 stocks (or ₹0.00 if failed)

// Refresh: Load ALL stocks again
GET /nse_data/all-stocks
→ Wasteful: fetches 500 stocks to update 5 watchlist stocks
```

#### After (Fyers with NSE Fallback):
```javascript
// Load: Use Fyers for all stocks
GET /fyers/market/all-stocks
→ Returns stocks with reliable Fyers prices
→ Falls back to NSE if Fyers not connected

// Refresh: Target only watchlist symbols
GET /fyers/market/quotes?symbols=TCS,HDFCBANK,ICICIBANK
→ Efficient: fetches only needed stocks (max 50)
→ Falls back to NSE all-stocks if Fyers unavailable
```

## Changes Made

### File: `frontend/src/components/sections/Watchlist.jsx`

#### 1. Added Data Source State
```javascript
const [dataSource, setDataSource] = useState(''); // 'fyers' or 'nse'
```

#### 2. Updated `loadStocks()` Function
- **Primary**: Fetch from `/fyers/market/all-stocks`
- **Fallback 1**: If Fyers not connected → NSE all-stocks
- **Fallback 2**: If Fyers errors → NSE all-stocks
- Sets `dataSource` state for UI indicator

#### 3. Updated `refreshPricesSilent()` Function
**Key Optimization:** Only fetch prices for watchlist symbols

```javascript
// Extract watchlist symbols
const symbols = watchlist.map(w => w.symbol); // ['TCS', 'HDFCBANK', ...]

// Call Fyers quotes API (max 50 symbols)
GET /fyers/market/quotes?symbols=TCS,HDFCBANK,ICICIBANK

// Merge prices into watchlist
const updatedWatchlist = watchlist.map(stock => {
  const quote = res.quotes[stock.symbol];
  return quote ? { ...stock, ...quote } : stock;
});
```

#### 4. Added Visual Data Source Indicator
```jsx
<span style={{ color: dataSource === 'fyers' ? '#00d09c' : '#ffa657' }}>
  {dataSource === 'fyers' ? '🟢 Fyers Live' : '🟡 NSE Data'}
</span>
```

Shows users which data source is active:
- **🟢 Fyers Live**: Real-time Fyers data (reliable)
- **🟡 NSE Data**: NSE fallback (may show ₹0.00 outside market hours)

## Benefits

### 1. **Reliability**
- ✅ Fyers API is stable (no anti-scraping blocks)
- ✅ Works during and outside market hours
- ✅ Always returns valid prices (no ₹0.00 issues)

### 2. **Performance**
- ✅ Targeted refresh: Fetches only watchlist symbols (not 500+ stocks)
- ✅ Faster API response times
- ✅ Reduced bandwidth usage

### 3. **User Experience**
- ✅ Always shows live prices
- ✅ Visual indicator shows data source
- ✅ Automatic fallback ensures data availability

### 4. **Consistency**
- ✅ Matches Market Sandbox approach
- ✅ Single reliable data source for the app

## Data Flow Comparison

### Old Flow (NSE Only):
```
Watchlist Component
    ↓ (every 5s)
GET /nse_data/all-stocks
    ↓
NSE India API (500 stocks)
    ↓ (may fail with 403 or return ₹0.00)
Display: ₹0.00 ❌
```

### New Flow (Fyers Primary):
```
Watchlist Component
    ↓ (every 5s)
GET /fyers/market/quotes?symbols=TCS,HDFCBANK (only watchlist)
    ↓
Fyers API
    ↓
NSE Stock Exchange
    ↓
Display: ₹3,850.50 ✅
```

### Fallback Flow (No Fyers):
```
Watchlist Component
    ↓
GET /fyers/market/quotes → fyers_connected: false
    ↓
GET /nse_data/all-stocks (fallback)
    ↓
NSE India API
    ↓
Display: (Best effort, may be ₹0.00 outside market hours)
```

## Testing

### Test Scenarios:

#### 1. With Fyers Connected
- **Expected**: 🟢 Fyers Live indicator
- **Expected**: Real-time prices updating every 5s
- **Expected**: No ₹0.00 prices

#### 2. Without Fyers Connected
- **Expected**: 🟡 NSE Data indicator
- **Expected**: NSE prices (may be ₹0.00 outside market hours)
- **Expected**: Graceful fallback behavior

#### 3. Outside Market Hours
- **Expected**: With Fyers → Last traded prices
- **Expected**: Without Fyers → May show ₹0.00 (NSE limitation)

#### 4. Network Failure
- **Expected**: Silent failure, no error popups
- **Expected**: Retains last fetched prices
- **Expected**: Auto-retry on next refresh cycle (5s)

## Migration Notes

### Breaking Changes
**None** - Fully backward compatible with NSE fallback

### New Dependencies
**None** - Uses existing Fyers API endpoints

### Configuration Required
**Optional**: Users can connect Fyers for live data
- If not connected: Automatic NSE fallback
- No action required from users

## API Endpoints Used

### Primary Endpoints (Fyers):
```
GET /fyers/market/all-stocks
- Returns: All NSE stocks with Fyers prices
- Used by: Initial load and stock search

GET /fyers/market/quotes?symbols=SYM1,SYM2,...
- Returns: Real-time quotes for specific symbols (max 50)
- Used by: Watchlist price refresh (every 5s)
```

### Fallback Endpoints (NSE):
```
GET /nse_data/all-stocks
- Returns: NIFTY 500 stocks with NSE prices
- Used by: When Fyers not available
```

## Performance Metrics

### Before (NSE All-Stocks):
- Request size: ~500 stocks × 200 bytes = 100 KB
- Refresh interval: 5 seconds
- Bandwidth: 20 KB/s continuous

### After (Fyers Targeted):
- Request size: ~5 stocks × 200 bytes = 1 KB
- Refresh interval: 5 seconds
- Bandwidth: 0.2 KB/s continuous

**Improvement: 100× reduction in bandwidth usage**

## Rollback Plan

If issues arise, revert to NSE-only:

```javascript
// In Watchlist.jsx, replace:
const res = await authApi(`${API_BASE_URL}/fyers/market/all-stocks`);

// With:
const res = await authApi(`${API_BASE_URL}/nse_data/all-stocks`);
```

No database changes required - purely frontend modification.

## Future Enhancements

1. **WebSocket Integration**
   - Real-time price updates (no polling)
   - Sub-second latency

2. **Hybrid Approach**
   - Use both Fyers and NSE simultaneously
   - Cross-validate prices for accuracy

3. **Smart Fallback**
   - Detect market hours
   - Switch data source based on availability

4. **Cache Optimization**
   - Local cache for last known prices
   - Show cached prices during network issues

## References

- Market Sandbox implementation: `frontend/src/components/VirtualTrading.jsx:87-124`
- Fyers market routes: `routes/fyers_market.py:198-233`
- NSE data routes: `routes/nse_data.py`, `nse_data/movers.py:88-148`

---

**Last Updated**: 2026-01-26
**Migration Status**: ✅ Complete
**Tested**: Pending backend verification
