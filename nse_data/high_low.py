from fastapi import APIRouter, HTTPException
import httpx
import asyncio

router = APIRouter()

NSE_52WEEK_URL = "https://www.nseindia.com/api/live-analysis-variations"

async def fetch_52week_data(index_type="gainers"):
    """Helper function to fetch 52-week high/low data from NSE
    
    Args:
        index_type: 'gainers' for 52-week high, 'losers' for 52-week low
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

            response = await client.get(f"{NSE_52WEEK_URL}?index={index_type}", headers=headers)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error fetching 52-week data: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")

@router.get("/52-week-high")
async def get_52_week_high():
    """Fetch stocks near 52-week high"""
    try:
        # Use 'gainers' parameter which returns a dict with multiple keys including 'SecGtr20'
        data = await fetch_52week_data("gainers")
        
        # Extract SecGtr20 data (securities trading within 20% of 52-week high)
        if isinstance(data, dict) and 'SecGtr20' in data:
            sec_data = data['SecGtr20']
            if isinstance(sec_data, dict) and 'data' in sec_data:
                items = sec_data['data']
                print(f"52-week high: Found {len(items) if isinstance(items, list) else 0} items")
                return {"stocks": items[:10] if isinstance(items, list) else []}
        
        print(f"52-week high: No data found in expected structure")
        return {"stocks": []}
    except Exception as e:
        print(f"Error in get_52_week_high: {e}")
        return {"stocks": []}

@router.get("/52-week-low")
async def get_52_week_low():
    """Fetch stocks near 52-week low"""
    try:
        # Use 'gainers' parameter which returns a dict with multiple keys including 'SecLwr20'
        data = await fetch_52week_data("gainers")
        
        # Extract SecLwr20 data (securities trading within 20% of 52-week low)
        if isinstance(data, dict) and 'SecLwr20' in data:
            sec_data = data['SecLwr20']
            if isinstance(sec_data, dict) and 'data' in sec_data:
                items = sec_data['data']
                print(f"52-week low: Found {len(items) if isinstance(items, list) else 0} items")
                return {"stocks": items[:10] if isinstance(items, list) else []}
        
        print(f"52-week low: No data found in expected structure")
        return {"stocks": []}
    except Exception as e:
        print(f"Error in get_52_week_low: {e}")
        return {"stocks": []}
