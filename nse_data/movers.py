from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter()

NSE_API_URL = "https://www.nseindia.com/api/live-analysis-variations?index=gainers"

@router.get("/top-gainers")
async def get_top_gainers():
    """Fetch top gainers from NSE"""
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Referer": "https://www.nseindia.com"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(NSE_API_URL, headers=headers)
            response.raise_for_status()
            data = response.json()
            gainers = data.get("data", [])
            return {"top_gainers": gainers}
        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")
        
        
@router.get("/top-losers")
async def get_top_losers():
    """Fetch top losers from NSE"""
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Referer": "https://www.nseindia.com"
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(NSE_API_URL.replace("gainers", "losers"), headers=headers)
            response.raise_for_status()
            data = response.json()
            losers = data.get("data", [])
            return {"top_losers": losers}
        except httpx.HTTPError as e:
            raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")