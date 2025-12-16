from fastapi import APIRouter, HTTPException
import httpx
import asyncio
from datetime import datetime, timedelta
import random
import traceback

router = APIRouter()

# --- Configuration ---
SNAPSHOT_URL = "https://www.nseindia.com/api/snapshot/capital-market/bulk-block-deals"
HISTORICAL_URL = "https://www.nseindia.com/api/historical/bulk-deals"

# Robust Headers
def get_browser_headers():
    return {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/market-data/large-deals",
        "Origin": "https://www.nseindia.com",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors", 
        "Sec-Fetch-Site": "same-origin",
        "X-Requested-With": "XMLHttpRequest"
    }

async def fetch_with_retry(url, retries=2):
    """
    Robust fetcher to get data from NSE with session management.
    """
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        for attempt in range(retries):
            try:
                # 1. Visit Homepage to get fresh cookies
                home_headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Upgrade-Insecure-Requests": "1"
                }
                
                # Add random jitter
                await asyncio.sleep(random.uniform(0.5, 1.5))
                await client.get("https://www.nseindia.com", headers=home_headers)
                
                # 2. Make API Request
                await asyncio.sleep(random.uniform(0.5, 1.0))
                
                # Force specific Referer for Bulk Deals
                api_headers = get_browser_headers()
                
                print(f"Fetching: {url}")
                response = await client.get(url, headers=api_headers)
                
                if response.status_code == 200:
                    return response.json()
                elif response.status_code in [401, 403]:
                    print(f"Access Denied ({response.status_code}). Retrying...")
                    await asyncio.sleep(2)
                    continue
                else:
                    print(f"Failed with status {response.status_code}")
                    # If 404, maybe invalid endpoint for today, break to fallback
                    if response.status_code == 404:
                        break
            
            except Exception as e:
                print(f"Error in fetch attempt {attempt+1}: {e}")
                await asyncio.sleep(1)
                
    return None

# --- Mock Data Failure Fallback ---
def get_mock_bulk_deals():
    """Fallback data if NSE blocks us"""
    symbols = ["RELIANCE", "HDFCBANK", "INFY", "TCS", "SBIN", "ICICIBANK", "AXISBANK", "KOTAKBANK", "LT", "ITC"]
    clients = ["VANGUARD FUNDS", "BLACKROCK INDIA", "LIC OF INDIA", "GOVERNMENT PENSION FUND", "MORGAN STANLEY ASIA", "ABU DHABI INVESTMENT AUTHORITY"]
    
    data = []
    for _ in range(12):
        price = round(random.uniform(400, 3500), 2)
        qty = random.randint(50000, 1000000)
        data.append({
            "symbol": random.choice(symbols),
            "clientName": random.choice(clients),
            "buySell": random.choice(["BUY", "SELL"]),
            "quantity": qty,
            "tradePrice": price, # Standard key
            "avgPrice": price,   # Alternative key
            "remarks": "Simulated Data (Use Proxy for Real)"
        })
    return data

@router.get("/bulk-deals")
async def get_bulk_deals():
    """Fetch bulk deals for today with fallback"""
    today = datetime.now().strftime("%d-%m-%Y")
    
    # Strategy: Try Snapshot URL (Best for 'Latest/Today')
    # If that fails, return Mock data to ensure App functionality
    
    data = await fetch_with_retry(SNAPSHOT_URL)
    
    if data:
        # Structure is usually { "bulk": { "data": [...] } }
        if "bulk" in data and "data" in data["bulk"]:
             return {"bulk_deals": data["bulk"]["data"], "date": today, "source": "live"}
    
    # Fallback
    print("Serving Mock Bulk Deals due to API block")
    return {"bulk_deals": get_mock_bulk_deals(), "date": today, "source": "simulated"}

@router.get("/block-deals")
async def get_block_deals():
    """Fetch block deals for today with fallback"""
    today = datetime.now().strftime("%d-%m-%Y")
    
    data = await fetch_with_retry(SNAPSHOT_URL)
    
    if data:
         # Structure is usually { "block": { "data": [...] } }
        if "block" in data and "data" in data["block"]:
             return {"block_deals": data["block"]["data"], "date": today, "source": "live"}

    # Fallback Mock
    print("Serving Mock Block Deals due to API block")
    return {"block_deals": get_mock_bulk_deals(), "date": today, "source": "simulated"}
