from fastapi import APIRouter
import httpx
import asyncio
from services.cache import cache

router = APIRouter()

NSE_INDICES_URL = "https://www.nseindia.com/api/allIndices"
BSE_SENSEX_URL = "https://api.bseindia.com/BseIndiaAPI/api/GetSensexData/w?flag=0"

# Key indices to show
KEY_INDICES = [
    "NIFTY 50",
    "NIFTY BANK",
    "NIFTY NEXT 50",
    "NIFTY MIDCAP 50",
    "NIFTY IT",
    "NIFTY FINANCIAL SERVICES",
    "NIFTY AUTO",
    "NIFTY PHARMA",
    "NIFTY METAL",
    "NIFTY REALTY",
]

# Major tradeable indices (for F&O)
MAJOR_INDICES = ["NIFTY 50", "NIFTY BANK", "NIFTY FIN SERVICE"]

# Cache TTL
TTL_INDICES = 30  # 30 seconds

# In-flight locks for deduplication
_indices_lock: asyncio.Lock | None = None
_sensex_lock: asyncio.Lock | None = None
_RAW_INDICES_TTL = 30  # 30 seconds for raw indices data
_RAW_SENSEX_TTL = 30   # 30 seconds for raw sensex data


async def fetch_indices_data():
    """Fetch all indices data from NSE with raw-data caching and dedup."""
    global _indices_lock
    raw_cache_key = "nse_raw:all_indices"

    cached = cache.get(raw_cache_key)
    if cached is not None:
        return cached

    if _indices_lock is None:
        _indices_lock = asyncio.Lock()

    async with _indices_lock:
        cached = cache.get(raw_cache_key)
        if cached is not None:
            return cached

        data = await _do_fetch_indices()
        cache.set(raw_cache_key, data, _RAW_INDICES_TTL)
        return data


async def _do_fetch_indices():
    """Perform the actual HTTP call to NSE for indices."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/",
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        try:
            try:
                await client.get("https://www.nseindia.com", headers=headers)
                await asyncio.sleep(0.3)
            except Exception:
                pass

            response = await client.get(NSE_INDICES_URL, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("data", [])
        except Exception as e:
            print(f"Error fetching indices: {e}")
            return []


async def fetch_sensex_data():
    """Fetch SENSEX data from BSE with raw-data caching and dedup."""
    global _sensex_lock
    raw_cache_key = "nse_raw:sensex"

    cached = cache.get(raw_cache_key)
    if cached is not None:
        return cached

    if _sensex_lock is None:
        _sensex_lock = asyncio.Lock()

    async with _sensex_lock:
        cached = cache.get(raw_cache_key)
        if cached is not None:
            return cached

        data = await _do_fetch_sensex()
        if not data.get("error"):
            cache.set(raw_cache_key, data, _RAW_SENSEX_TTL)
        return data


async def _do_fetch_sensex():
    """Perform the actual HTTP call to BSE for SENSEX data."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.bseindia.com/",
        "Origin": "https://www.bseindia.com",
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        try:
            response = await client.get(BSE_SENSEX_URL, headers=headers)
            response.raise_for_status()
            data = response.json()
            if data:
                return {
                    "index": "SENSEX",
                    "last": float(data.get("CurrVal", 0)),
                    "variation": float(data.get("Chg", 0)),
                    "percentChange": float(data.get("PcChg", 0)),
                    "open": float(data.get("Open", 0)),
                    "high": float(data.get("High", 0)),
                    "low": float(data.get("Low", 0)),
                    "previousClose": float(data.get("PrevClose", 0)),
                }
        except Exception as e:
            print(f"Error fetching SENSEX: {e}")
            return {
                "index": "SENSEX",
                "last": 0,
                "variation": 0,
                "percentChange": 0,
                "open": 0,
                "high": 0,
                "low": 0,
                "previousClose": 0,
                "error": "Unable to fetch live data"
            }


@router.get("/indices")
async def get_indices():
    """Get major market indices (NIFTY 50, BANK NIFTY, etc.)"""
    # Check cache
    cache_key = "indices:key"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    all_indices = await fetch_indices_data()
    
    # Filter to key indices only
    filtered = []
    for idx in all_indices:
        if idx.get("index") in KEY_INDICES:
            filtered.append({
                "index": idx.get("index"),
                "last": idx.get("last"),
                "variation": idx.get("variation"),
                "percentChange": idx.get("percentChange"),
                "open": idx.get("open"),
                "high": idx.get("high"),
                "low": idx.get("low"),
                "previousClose": idx.get("previousClose"),
            })
    
    # Sort by the order in KEY_INDICES
    filtered.sort(key=lambda x: KEY_INDICES.index(x["index"]) if x["index"] in KEY_INDICES else 999)
    
    result = {"indices": filtered}
    cache.set(cache_key, result, TTL_INDICES)
    return result


@router.get("/all-indices")
async def get_all_indices():
    """Get all available indices"""
    all_indices = await fetch_indices_data()
    return {"indices": all_indices}


@router.get("/major-indices")
async def get_major_indices():
    """
    Get major tradeable indices: NIFTY 50, SENSEX, BANK NIFTY.
    These are the primary indices used for trading and tracking.
    """
    # Check cache
    cache_key = "indices:major"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    # Fetch NSE indices and SENSEX in parallel
    nse_indices, sensex = await asyncio.gather(
        fetch_indices_data(),
        fetch_sensex_data(),
        return_exceptions=True
    )
    
    major = []
    
    # Handle NSE indices
    if isinstance(nse_indices, list):
        for idx in nse_indices:
            if idx.get("index") in MAJOR_INDICES:
                index_name = idx.get("index")
                # Use shorter names for display
                display_name = {
                    "NIFTY 50": "NIFTY",
                    "NIFTY BANK": "BANKNIFTY",
                    "NIFTY FIN SERVICE": "FINNIFTY",
                }.get(index_name, index_name)
                
                major.append({
                    "symbol": display_name,
                    "indexName": index_name,
                    "last": idx.get("last", 0),
                    "change": idx.get("variation", 0),
                    "pChange": idx.get("percentChange", 0),
                    "open": idx.get("open", 0),
                    "high": idx.get("high", 0),
                    "low": idx.get("low", 0),
                    "previousClose": idx.get("previousClose", 0),
                    "exchange": "NSE",
                    "isTradeable": True,  # Has F&O
                })
    
    # Add SENSEX
    if isinstance(sensex, dict) and not sensex.get("error"):
        major.insert(1, {  # Insert after NIFTY
            "symbol": "SENSEX",
            "indexName": "S&P BSE SENSEX",
            "last": sensex.get("last", 0),
            "change": sensex.get("variation", 0),
            "pChange": sensex.get("percentChange", 0),
            "open": sensex.get("open", 0),
            "high": sensex.get("high", 0),
            "low": sensex.get("low", 0),
            "previousClose": sensex.get("previousClose", 0),
            "exchange": "BSE",
            "isTradeable": False,  # No F&O on NSE
        })
    
    # Sort to ensure NIFTY, SENSEX, BANKNIFTY order
    order = ["NIFTY", "SENSEX", "BANKNIFTY", "FINNIFTY"]
    major.sort(key=lambda x: order.index(x["symbol"]) if x["symbol"] in order else 999)
    
    result = {"indices": major}
    cache.set(cache_key, result, TTL_INDICES)
    return result


@router.get("/index/{symbol}")
async def get_index_detail(symbol: str):
    """
    Get detailed data for a specific index.
    Supports: NIFTY, BANKNIFTY, FINNIFTY, SENSEX, etc.
    """
    symbol = symbol.upper().strip()
    
    # Map short names to full names
    symbol_map = {
        "NIFTY": "NIFTY 50",
        "BANKNIFTY": "NIFTY BANK",
        "FINNIFTY": "NIFTY FIN SERVICE",
        "NIFTY50": "NIFTY 50",
    }
    
    full_name = symbol_map.get(symbol, symbol)
    
    # Special handling for SENSEX
    if symbol == "SENSEX":
        sensex = await fetch_sensex_data()
        return {"index": sensex}
    
    # Fetch from NSE
    all_indices = await fetch_indices_data()
    
    for idx in all_indices:
        if idx.get("index") == full_name:
            return {
                "index": {
                    "symbol": symbol,
                    "indexName": idx.get("index"),
                    "last": idx.get("last"),
                    "change": idx.get("variation"),
                    "pChange": idx.get("percentChange"),
                    "open": idx.get("open"),
                    "high": idx.get("high"),
                    "low": idx.get("low"),
                    "previousClose": idx.get("previousClose"),
                    "yearHigh": idx.get("yearHigh"),
                    "yearLow": idx.get("yearLow"),
                    "advances": idx.get("advances"),
                    "declines": idx.get("declines"),
                    "unchanged": idx.get("unchanged"),
                }
            }
    
    return {"error": f"Index {symbol} not found"}

