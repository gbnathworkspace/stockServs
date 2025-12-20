from fastapi import APIRouter, HTTPException
import httpx
import asyncio
import csv
import io

router = APIRouter()

BASE_API_URL = "https://www.nseindia.com/api/equity-stockIndices?index="
DEFAULT_INDEX = "NIFTY 50"
# Daily master list of all active equities
EQUITY_LIST_URL = "https://archives.nseindia.com/content/equities/EQUITY_L.csv"


async def fetch_index_data(index_name: str = DEFAULT_INDEX):
    """Helper function to fetch index constituents."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }

    url = f"{BASE_API_URL}{index_name.replace(' ', '%20')}"

    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            # Try to get cookies, but don't fail if it errors (it might 403 but still set cookies or API might work)
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
    """Return the full list of stocks for the virtual trading tab (complete NSE equity list)."""
    data = await fetch_all_equities()
    return {"stocks": data}

@router.get("/top-gainers")
async def get_top_gainers():
    """Fetch top gainers from NSE (NIFTY 50)"""
    data = await fetch_index_data(DEFAULT_INDEX)
    
    # Sort by pChange descending
    sorted_data = sorted(data, key=lambda x: float(x.get("pChange", 0)), reverse=True)
    
    # Return top 10
    return {"top_gainers": sorted_data[:10]}

@router.get("/top-losers")
async def get_top_losers():
    """Fetch top losers from NSE (NIFTY 50)"""
    data = await fetch_index_data(DEFAULT_INDEX)
    
    # Sort by pChange ascending
    sorted_data = sorted(data, key=lambda x: float(x.get("pChange", 0)))
    
    # Return top 10
    return {"top_losers": sorted_data[:10]}
