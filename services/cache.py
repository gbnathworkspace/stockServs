"""
Simple in-memory cache service for reducing API latency.
TTL-based caching for stock data, prices, and market information.
"""

from datetime import datetime, timedelta
from typing import Any, Optional
import threading


class SimpleCache:
    """Thread-safe in-memory cache with TTL support."""

    def __init__(self):
        self._cache: dict[str, Any] = {}
        self._expiry: dict[str, datetime] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Optional[Any]:
        """Get a value from cache if it exists and hasn't expired."""
        with self._lock:
            if key in self._cache:
                if datetime.now() < self._expiry.get(key, datetime.min):
                    return self._cache[key]
                else:
                    # Clean up expired entry
                    del self._cache[key]
                    del self._expiry[key]
            return None

    def set(self, key: str, value: Any, ttl_seconds: int = 60) -> None:
        """Set a value in cache with TTL in seconds."""
        with self._lock:
            self._cache[key] = value
            self._expiry[key] = datetime.now() + timedelta(seconds=ttl_seconds)

    def delete(self, key: str) -> bool:
        """Delete a key from cache. Returns True if key existed."""
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                del self._expiry[key]
                return True
            return False

    def clear(self) -> None:
        """Clear all cache entries."""
        with self._lock:
            self._cache.clear()
            self._expiry.clear()

    def cleanup_expired(self) -> int:
        """Remove all expired entries. Returns count of removed entries."""
        with self._lock:
            now = datetime.now()
            expired_keys = [
                key for key, exp in self._expiry.items()
                if exp < now
            ]
            for key in expired_keys:
                del self._cache[key]
                del self._expiry[key]
            return len(expired_keys)

    def stats(self) -> dict:
        """Get cache statistics."""
        with self._lock:
            return {
                "entries": len(self._cache),
                "keys": list(self._cache.keys())[:20]  # First 20 keys
            }


# Global cache instance
cache = SimpleCache()


# Cache key generators
def stock_list_key() -> str:
    return "nse:all_stocks"

def stock_price_key(symbol: str) -> str:
    return f"price:{symbol}"

def candle_key(symbol: str, interval: str, period: str) -> str:
    return f"candle:{symbol}:{interval}:{period}"

def weekly_gainers_key() -> str:
    return "nse:weekly_gainers"

def bulk_deals_key() -> str:
    return "nse:bulk_deals"

def top_gainers_key() -> str:
    return "nse:top_gainers"

def top_losers_key() -> str:
    return "nse:top_losers"

def fii_dii_activity_key() -> str:
    return "nse:fii_dii_activity"

def sector_heatmap_key() -> str:
    return "nse:sector_heatmap"

def sector_stocks_key(sector: str) -> str:
    return f"nse:sector_stocks:{sector}"


# TTL constants (in seconds)
TTL_STOCK_LIST = 300       # 5 minutes - reduced API load while keeping data fresh
TTL_STOCK_PRICE = 30       # 30 seconds - prices change frequently
TTL_CANDLE_5M = 60         # 1 minute for 5-minute candles
TTL_CANDLE_15M = 120       # 2 minutes for 15-minute candles
TTL_CANDLE_1D = 600        # 10 minutes for daily candles
TTL_WEEKLY_GAINERS = 300   # 5 minutes - computed data
TTL_BULK_DEALS = 300       # 5 minutes - bulk deals
TTL_TOP_GAINERS = 300      # 5 minutes - market movers
TTL_TOP_LOSERS = 300       # 5 minutes - market movers
TTL_FII_DII = 600          # 10 minutes - FII/DII activity data
TTL_SECTOR_DATA = 300      # 5 minutes - sector heatmap data
