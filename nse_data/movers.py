from fastapi import APIRouter, HTTPException
import httpx
import asyncio

router = APIRouter()

NSE_API_URL = "https://www.nseindia.com/api/equity-stockIndices?index=NIFTY%2050"

@router.get("/top-gainers")
async def get_top_gainers():
    """Fetch top gainers from NSE"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.nseindia.com/"
    }

    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            # Get cookies by visiting homepage
            homepage_response = await client.get("https://www.nseindia.com", headers=headers)
            print(f"Homepage status: {homepage_response.status_code}")
            print(f"Cookies received: {client.cookies}")

            # Small delay to mimic human behavior
            await asyncio.sleep(1)

            response = await client.get(NSE_API_URL, headers=headers)
            print(f"API status: {response.status_code}")
            response.raise_for_status()
            data = response.json()
            print(f"Data keys: {data.keys()}")
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