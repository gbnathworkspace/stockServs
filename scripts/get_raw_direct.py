import asyncio
import sys
import os
import json
import httpx
import time

async def get_raw_nse_direct():
    print("--- ATTEMPTING DIRECT RAW FETCH FROM NSE ---")
    
    symbol = "NIFTY"
    # url = f"https://www.nseindia.com/api/option-chain-indices?symbol={symbol}"
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        try:
            # 1. Hit the home page to get cookies
            print("Step 1: Warming up session...")
            r1 = await client.get("https://www.nseindia.com", headers=headers)
            print(f"Status: {r1.status_code}")
            
            await asyncio.sleep(1)
            
            # 2. Hit the option chain page
            print("Step 2: Visiting Option Chain page...")
            headers["Referer"] = "https://www.nseindia.com/"
            r2 = await client.get("https://www.nseindia.com/option-chain", headers=headers)
            print(f"Status: {r2.status_code}")
            
            await asyncio.sleep(1)
            
            # 3. Hit the actual API
            print("Step 3: Fetching raw API data...")
            api_url = f"https://www.nseindia.com/api/option-chain-indices?symbol={symbol}"
            headers["Referer"] = "https://www.nseindia.com/option-chain"
            headers["Accept"] = "application/json, text/plain, */*"
            headers["X-Requested-With"] = "XMLHttpRequest"
            
            r3 = await client.get(api_url, headers=headers)
            print(f"Status: {r3.status_code}")
            
            if r3.status_code == 200:
                data = r3.json()
                print("\n--- RAW JSON STRUCTURE ---")
                print(json.dumps(data, indent=2)[:2000] + "...") # Show first 2000 chars
                
                with open("raw_market_debug.json", "w") as f:
                    json.dump(data, f, indent=2)
                print(f"\nSaved full raw response to raw_market_debug.json")
            else:
                print(f"Failed to fetch. Response text: {r3.text[:200]}")

        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(get_raw_nse_direct())
