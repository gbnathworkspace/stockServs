from fastapi import APIRouter, HTTPException
import httpx
import asyncio
from typing import List, Dict

router = APIRouter()

NSE_QUOTE_URL = "https://www.nseindia.com/api/quote-equity?symbol="
NSE_DELIVERY_URL = "https://www.nseindia.com/api/reports/deliverable-quantity"


async def fetch_delivery_data_for_symbol(symbol: str):
    """
    Fetch delivery data for a single stock symbol.
    Returns delivery quantity and percentage.
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        try:
            # Get cookies first
            try:
                await client.get("https://www.nseindia.com", headers=headers)
                await asyncio.sleep(0.3)
            except Exception:
                pass

            # Fetch quote data which includes delivery info
            response = await client.get(f"{NSE_QUOTE_URL}{symbol}", headers=headers)
            response.raise_for_status()
            data = response.json()

            # Extract delivery data from securities info
            security_info = data.get("securityInfo", {})
            delivery_pct = security_info.get("deliveryToTradedQuantity", 0)

            # Extract price and volume data
            price_info = data.get("priceInfo", {})
            last_price = price_info.get("lastPrice", 0)

            # Get traded quantity from pre-open or market data
            pre_open = data.get("preOpenMarket", {})
            market_data = pre_open.get("data", [{}])[0] if pre_open.get("data") else {}
            traded_qty = market_data.get("totalTradedVolume", 0)

            return {
                "symbol": symbol,
                "deliveryPct": round(delivery_pct, 2),
                "lastPrice": last_price,
                "tradedQty": traded_qty,
                "deliveryQty": int(traded_qty * delivery_pct / 100) if traded_qty and delivery_pct else 0
            }

        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None  # Symbol not found
            raise
        except Exception as e:
            print(f"Error fetching delivery data for {symbol}: {e}")
            return None


async def fetch_bulk_delivery_leaders(min_delivery_pct: float = 60.0):
    """
    Fetch delivery data for multiple stocks and filter by delivery %.
    Uses NIFTY 200 constituents as the universe.
    """
    from nse_data.movers import fetch_index_data

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }

    try:
        # Get NIFTY 200 stocks as our universe
        stocks = await fetch_index_data("NIFTY 200")

        # NSE provides deliverable quantity data in a bulk report
        # We'll need to fetch individual stock data or use the bulk report

        results = []
        for stock in stocks[:50]:  # Limit to top 50 for performance
            symbol = stock.get("symbol")
            if not symbol:
                continue

            delivery_data = await fetch_delivery_data_for_symbol(symbol)
            if delivery_data and delivery_data.get("deliveryPct", 0) >= min_delivery_pct:
                # Add price change from stock data
                delivery_data["priceChange"] = stock.get("pChange", 0)
                delivery_data["lastPrice"] = stock.get("lastPrice", delivery_data.get("lastPrice"))
                results.append(delivery_data)

            # Rate limiting
            await asyncio.sleep(0.2)

        # Sort by delivery percentage
        results.sort(key=lambda x: x.get("deliveryPct", 0), reverse=True)
        return results[:20]  # Return top 20

    except Exception as e:
        print(f"Error fetching delivery leaders: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch delivery data: {str(e)}")


@router.get("/delivery/{symbol}")
async def get_delivery_for_symbol(symbol: str):
    """
    Fetch delivery data for a specific stock symbol.
    Example: /delivery/RELIANCE
    """
    data = await fetch_delivery_data_for_symbol(symbol.upper())

    if not data:
        raise HTTPException(status_code=404, detail=f"Delivery data not found for {symbol}")

    return data


@router.get("/delivery-leaders")
async def get_delivery_leaders(min_pct: float = 60.0):
    """
    Fetch stocks with high delivery percentage (default: >60%).
    Indicates strong investor conviction and cash market activity.
    """
    from services.cache import cache, TTL_NSE_DATA

    # Check cache first
    cache_key = f"delivery_leaders_{min_pct}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # Fetch fresh data
    leaders = await fetch_bulk_delivery_leaders(min_pct)

    result = {
        "delivery_leaders": leaders,
        "min_delivery_pct": min_pct,
        "count": len(leaders)
    }

    # Cache for 30 seconds
    cache.set(cache_key, result, TTL_NSE_DATA)

    return result
