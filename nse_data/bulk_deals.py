from fastapi import APIRouter, HTTPException
import httpx
import asyncio
from datetime import datetime, timedelta

router = APIRouter()

NSE_BULK_DEALS_URL = "https://www.nseindia.com/api/historical/bulk-deals"
NSE_BLOCK_DEALS_URL = "https://www.nseindia.com/api/historical/block-deals"

async def fetch_deals_data(url, from_date, to_date):
    """Helper function to fetch bulk/block deals data from NSE"""
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

            response = await client.get(f"{url}?from={from_date}&to={to_date}", headers=headers)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error fetching deals data: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")

@router.get("/bulk-deals")
async def get_bulk_deals():
    """Fetch bulk deals for today"""
    today = datetime.now().strftime("%d-%m-%Y")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%d-%m-%Y")
    
    data = await fetch_deals_data(NSE_BULK_DEALS_URL, yesterday, today)
    
    return {"bulk_deals": data if isinstance(data, list) else data.get("data", []), "date": today}

@router.get("/block-deals")
async def get_block_deals():
    """Fetch block deals for today"""
    today = datetime.now().strftime("%d-%m-%Y")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%d-%m-%Y")
    
    data = await fetch_deals_data(NSE_BLOCK_DEALS_URL, yesterday, today)
    
    return {"block_deals": data if isinstance(data, list) else data.get("data", []), "date": today}
