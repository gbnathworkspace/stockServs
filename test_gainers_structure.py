import asyncio
import httpx
import json

async def test_52week_endpoints():
    """Test different NSE API endpoints for 52-week high data"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }
    
    # Different endpoints to try
    endpoints_to_try = [
        ("live-analysis-variations", "gainers"),
        ("live-analysis-variations", "allSec"),
        ("live-analysis-oi-spurts-underlyings", ""),
    ]
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        # Get cookies first
        try:
            await client.get("https://www.nseindia.com", headers=headers)
            await asyncio.sleep(0.5)
        except:
            pass
        
        # Test gainers endpoint with detailed output
        print("Testing 'gainers' parameter in detail...")
        try:
            url = "https://www.nseindia.com/api/live-analysis-variations?index=gainers"
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                print(f"Top-level keys: {list(data.keys())}")
                
                # Check each key
                for key in data.keys():
                    val = data[key]
                    print(f"\n{key}:")
                    print(f"  Type: {type(val)}")
                    if isinstance(val, list):
                        print(f"  Length: {len(val)}")
                        if len(val) > 0:
                            print(f"  First item: {json.dumps(val[0], indent=4)[:300]}")
                    elif isinstance(val, dict):
                        print(f"  Dict keys: {list(val.keys())[:5]}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_52week_endpoints())
