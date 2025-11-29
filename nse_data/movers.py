from fastapi import APIRouter, HTTPException
import httpx
import asyncio

router = APIRouter()

NSE_API_URL = "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050"

async def fetch_nifty_data():
    """Helper function to fetch NIFTY 50 data"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }

    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            # Try to get cookies, but don't fail if it errors (it might 403 but still set cookies or API might work)
            try:
                await client.get("https://www.nseindia.com", headers=headers)
                await asyncio.sleep(0.5)
            except Exception:
                pass

            response = await client.get(NSE_API_URL, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("data", [])
        except Exception as e:
            print(f"Error fetching NSE data: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")

@router.get("/top-gainers")
async def get_top_gainers():
    """Fetch top gainers from NSE (NIFTY 50)"""
    data = await fetch_nifty_data()
    
    # Sort by pChange descending
    sorted_data = sorted(data, key=lambda x: float(x.get("pChange", 0)), reverse=True)
    
    # Return top 10
    return {"top_gainers": sorted_data[:10]}

@router.get("/top-losers")
async def get_top_losers():
    """Fetch top losers from NSE (NIFTY 50)"""
    data = await fetch_nifty_data()
    
    # Sort by pChange ascending
    sorted_data = sorted(data, key=lambda x: float(x.get("pChange", 0)))
    
    # Return top 10
    return {"top_losers": sorted_data[:10]}