from fastapi import APIRouter, HTTPException
import httpx
import asyncio
import csv
import io

from services.cache import cache, stock_list_key, TTL_STOCK_LIST

router = APIRouter()

BASE_API_URL = "https://www.nseindia.com/api/equity-stockIndices?index="
DEFAULT_INDEX = "NIFTY 50"
# Daily master list of all active equities
EQUITY_LIST_URL = "https://archives.nseindia.com/content/equities/EQUITY_L.csv"

# In-flight request deduplication: prevents multiple concurrent callers from
# each triggering a separate slow HTTP request to the same NSE endpoint.
_inflight_locks: dict[str, asyncio.Lock] = {}

# TTL for raw index data cache (seconds)
_RAW_INDEX_TTL = 120


async def fetch_index_data(index_name: str = DEFAULT_INDEX):
    """Helper function to fetch index constituents.

    Uses a two-layer optimisation:
    1. Raw-data cache so top-gainers + top-losers share one fetch.
    2. Per-index asyncio lock so concurrent requests don't each hit NSE.
    """
    raw_cache_key = f"nse_raw:index:{index_name}"

    # Fast path: serve from raw cache
    cached = cache.get(raw_cache_key)
    if cached is not None:
        return cached

    # Acquire a per-index lock so only one coroutine fetches at a time
    if index_name not in _inflight_locks:
        _inflight_locks[index_name] = asyncio.Lock()

    async with _inflight_locks[index_name]:
        # Double-check after acquiring lock (another coroutine may have filled cache)
        cached = cache.get(raw_cache_key)
        if cached is not None:
            return cached

        data = await _do_fetch_index(index_name)
        cache.set(raw_cache_key, data, _RAW_INDEX_TTL)
        return data


async def _do_fetch_index(index_name: str):
    """Perform the actual HTTP call to NSE."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }

    url = f"{BASE_API_URL}{index_name.replace(' ', '%20')}"

    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        try:
            try:
                await client.get("https://www.nseindia.com", headers=headers)
                await asyncio.sleep(0.5)
            except Exception:
                pass

            response = await client.get(url, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("data", [])
        except Exception as e:
            print(f"Error fetching NSE data for {index_name}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")


async def fetch_all_equities():
    """
    Fetch the complete list of NSE equities using the daily EQUITY_L.csv file.
    This list includes all actively listed equities (similar to Kite search).
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/csv",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        try:
            # warm cookies
            try:
                await client.get("https://www.nseindia.com", headers=headers)
                await asyncio.sleep(0.3)
            except Exception:
                pass

            resp = await client.get(EQUITY_LIST_URL, headers=headers)
            resp.raise_for_status()
            content = resp.text
            reader = csv.DictReader(io.StringIO(content))
            items = []
            for row in reader:
                symbol = (row.get("SYMBOL") or "").strip()
                series = (row.get(" SERIES") or row.get("SERIES") or "").strip()
                name = (row.get("NAME OF COMPANY") or "").strip()
                if not symbol:
                    continue
                items.append({
                    "symbol": symbol,
                    "identifier": name if name else "Equity",
                    "series": series,
                })
            return sorted(items, key=lambda x: x["symbol"])
        except Exception as e:
            print(f"Error fetching all equities list: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch all stocks: {str(e)}")

@router.get("/all-stocks")
async def get_all_stocks():
    """Return the full list of NIFTY 500 stocks with current prices for virtual trading.
    
    Fallback chain: NIFTY 500 -> NIFTY 200 -> NIFTY 100 -> All equities CSV
    """
    # Check cache first
    cache_key = stock_list_key()
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    def format_stocks(data):
        """Helper to format stock data consistently."""
        stocks = []
        for item in data:
            if item.get("symbol"):
                stocks.append({
                    "symbol": item.get("symbol", ""),
                    "identifier": item.get("identifier", "Equity"),
                    "lastPrice": item.get("lastPrice", 0),
                    "pChange": item.get("pChange", 0),
                    "dayHigh": item.get("dayHigh", 0),
                    "dayLow": item.get("dayLow", 0),
                    "open": item.get("open", 0),
                    "previousClose": item.get("previousClose", 0),
                })
        return sorted(stocks, key=lambda x: x["symbol"])

    # Try indices in order of preference (largest to smallest)
    indices_to_try = ["NIFTY 500", "NIFTY 200", "NIFTY 100"]
    
    for index_name in indices_to_try:
        try:
            data = await fetch_index_data(index_name)
            if data and len(data) > 0:
                stocks = format_stocks(data)
                result = {"stocks": stocks, "source": index_name, "count": len(stocks)}
                # Cache for 60 seconds
                cache.set(cache_key, result, TTL_STOCK_LIST)
                return result
        except Exception as e:
            print(f"Failed to fetch {index_name}: {e}")
            continue

    # Final fallback to equity list (all NSE stocks, but without live prices)
    try:
        data = await fetch_all_equities()
        for stock in data:
            stock["lastPrice"] = stock.get("lastPrice", 0)
            stock["pChange"] = stock.get("pChange", 0)
            stock["dayHigh"] = stock.get("dayHigh", 0)
            stock["dayLow"] = stock.get("dayLow", 0)
            stock["open"] = stock.get("open", 0)
            stock["previousClose"] = stock.get("previousClose", 0)
        result = {"stocks": data, "source": "EQUITY_L.csv", "count": len(data)}
        cache.set(cache_key, result, TTL_STOCK_LIST)
        return result
    except Exception as e:
        print(f"All stock fetch methods failed: {e}")
        return {"stocks": [], "source": "none", "count": 0, "error": str(e)}


@router.get("/top-gainers")
async def get_top_gainers():
    """Fetch top gainers from NSE (NIFTY 50)"""
    # Import at function level to avoid circular imports
    from services.cache import cache, top_gainers_key, TTL_TOP_GAINERS
    
    # Check cache first
    cached = cache.get(top_gainers_key())
    if cached is not None:
        return cached
    
    # Fetch fresh data
    data = await fetch_index_data(DEFAULT_INDEX)
    
    # Sort by pChange descending
    sorted_data = sorted(data, key=lambda x: float(x.get("pChange", 0)), reverse=True)
    
    # Return top 10
    result = {"top_gainers": sorted_data[:10]}
    
    # Cache for 5 minutes
    cache.set(top_gainers_key(), result, TTL_TOP_GAINERS)
    
    return result

@router.get("/top-losers")
async def get_top_losers():
    """Fetch top losers from NSE (NIFTY 50)"""
    # Import at function level to avoid circular imports
    from services.cache import cache, top_losers_key, TTL_TOP_LOSERS
    
    # Check cache first
    cached = cache.get(top_losers_key())
    if cached is not None:
        return cached
    
    # Fetch fresh data
    data = await fetch_index_data(DEFAULT_INDEX)

    # Sort by pChange ascending
    sorted_data = sorted(data, key=lambda x: float(x.get("pChange", 0)))

    # Return top 10
    result = {"top_losers": sorted_data[:10]}
    
    # Cache for 5 minutes
    cache.set(top_losers_key(), result, TTL_TOP_LOSERS)
    
    return result


@router.get("/nifty-contributors")
async def get_nifty_contributors():
    """
    Fetch Nifty 50 stocks data for index contribution analysis.
    Returns all Nifty 50 constituents with price data for calculating
    contribution points and OI signals.
    """
    data = await fetch_index_data(DEFAULT_INDEX)

    stocks = []
    for item in data:
        symbol = item.get("symbol")
        if symbol:
            stocks.append({
                "symbol": symbol,
                "lastPrice": item.get("lastPrice", 0),
                "ltp": item.get("lastPrice", 0),
                "previousClose": item.get("previousClose", 0),
                "prevClose": item.get("previousClose", 0),
                "pChange": item.get("pChange", 0),
                "change": item.get("change", 0),
                "dayHigh": item.get("dayHigh", 0),
                "dayLow": item.get("dayLow", 0),
                "open": item.get("open", 0),
                "totalTradedVolume": item.get("totalTradedVolume", 0),
                "totalTradedValue": item.get("totalTradedValue", 0),
                # OI data - will be 0 until we integrate F&O data
                "oiChange": 0,
                "oiChangePct": 0,
            })

    return {"stocks": stocks}
