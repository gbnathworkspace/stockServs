from fastapi import APIRouter, HTTPException
import httpx
import asyncio

router = APIRouter()

NSE_FII_DII_URL = "https://www.nseindia.com/api/fiidiiTradeReact"

async def fetch_fii_dii_data():
    """Helper function to fetch FII/DII activity data from NSE"""
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

            response = await client.get(NSE_FII_DII_URL, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error fetching FII/DII data: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")

@router.get("/fii-dii-activity")
async def get_fii_dii_activity():
    """Fetch FII/DII activity data (buy/sell values and net flows)"""
    data = await fetch_fii_dii_data()
    
    # Parse the response to separate FII and DII data
    fii_data = None
    dii_data = None
    
    for item in data:
        if "FII" in item.get("category", ""):
            fii_data = item
        elif "DII" in item.get("category", ""):
            dii_data = item
    
    return {
        "fii": fii_data,
        "dii": dii_data,
        "date": fii_data.get("date") if fii_data else None
    }
