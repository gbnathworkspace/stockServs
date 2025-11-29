from fastapi import APIRouter, HTTPException
import httpx
import asyncio

router = APIRouter()

NSE_MOST_ACTIVE_URL = "https://www.nseindia.com/api/live-analysis-most-active-securities"

async def fetch_most_active_data(index_type="value"):
    """Helper function to fetch most active stocks data from NSE
    
    Args:
        index_type: 'value' or 'volume'
    """
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }

    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            # Try to get cookies
            try:
                await client.get("https://www.nseindia.com", headers=headers)
                await asyncio.sleep(0.5)
            except Exception:
                pass

            response = await client.get(f"{NSE_MOST_ACTIVE_URL}?index={index_type}", headers=headers)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error fetching most active data: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")

@router.get("/most-active-value")
async def get_most_active_by_value():
    """Fetch most active stocks by value (turnover)"""
    data = await fetch_most_active_data("value")
    
    # Handle both list and dict responses
    if isinstance(data, dict):
        items = data.get("data", [])
    else:
        items = data
    
    return {"most_active": items[:10] if items else []}

@router.get("/most-active-volume")
async def get_most_active_by_volume():
    """Fetch most active stocks by volume"""
    data = await fetch_most_active_data("volume")
    
    # Handle both list and dict responses
    if isinstance(data, dict):
        items = data.get("data", [])
    else:
        items = data
    
    return {"most_active": items[:10] if items else []}
