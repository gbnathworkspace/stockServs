from fastapi import APIRouter
import httpx
import asyncio

router = APIRouter()

NSE_INDICES_URL = "https://www.nseindia.com/api/allIndices"

# Key indices to show
KEY_INDICES = [
    "NIFTY 50",
    "NIFTY BANK",
    "NIFTY NEXT 50",
    "NIFTY MIDCAP 50",
    "NIFTY IT",
    "NIFTY FINANCIAL SERVICES",
]


async def fetch_indices_data():
    """Fetch all indices data from NSE"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/",
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        try:
            # Get cookies first
            try:
                await client.get("https://www.nseindia.com", headers=headers)
                await asyncio.sleep(0.3)
            except Exception:
                pass

            response = await client.get(NSE_INDICES_URL, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data.get("data", [])
        except Exception as e:
            print(f"Error fetching indices: {e}")
            return []


@router.get("/indices")
async def get_indices():
    """Get major market indices (NIFTY 50, BANK NIFTY, etc.)"""
    all_indices = await fetch_indices_data()
    
    # Filter to key indices only
    filtered = []
    for idx in all_indices:
        if idx.get("index") in KEY_INDICES:
            filtered.append({
                "index": idx.get("index"),
                "last": idx.get("last"),
                "variation": idx.get("variation"),
                "percentChange": idx.get("percentChange"),
                "open": idx.get("open"),
                "high": idx.get("high"),
                "low": idx.get("low"),
                "previousClose": idx.get("previousClose"),
            })
    
    # Sort by the order in KEY_INDICES
    filtered.sort(key=lambda x: KEY_INDICES.index(x["index"]) if x["index"] in KEY_INDICES else 999)
    
    return {"indices": filtered}


@router.get("/all-indices")
async def get_all_indices():
    """Get all available indices"""
    all_indices = await fetch_indices_data()
    return {"indices": all_indices}
