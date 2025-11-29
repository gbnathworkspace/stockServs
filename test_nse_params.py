import asyncio
import httpx

async def test_nse_endpoints():
    """Test different NSE API parameters to find the right one"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }
    
    base_url = "https://www.nseindia.com/api/live-analysis-variations"
    
    # Different parameter values to try
    params_to_try = [
        "gainers",
        "losers", 
        "52_week_high_low",
        "52weekhigh",
        "52weeklow",
        "allSec"
    ]
    
    async with httpx.AsyncClient(follow_redirects=True) as client:
        # Get cookies first
        try:
            await client.get("https://www.nseindia.com", headers=headers)
            await asyncio.sleep(0.5)
        except:
            pass
        
        for param in params_to_try:
            print(f"\n{'='*60}")
            print(f"Testing parameter: {param}")
            print('='*60)
            try:
                url = f"{base_url}?index={param}"
                response = await client.get(url, headers=headers)
                print(f"Status: {response.status_code}")
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        print(f"Response type: {type(data)}")
                        if isinstance(data, dict):
                            print(f"Keys: {list(data.keys())}")
                            if 'data' in data:
                                items = data['data']
                                print(f"Data items count: {len(items) if isinstance(items, list) else 'not a list'}")
                                if isinstance(items, list) and len(items) > 0:
                                    print(f"First item keys: {list(items[0].keys())[:5]}")
                        else:
                            print(f"Response: {data[:200] if len(str(data)) > 200 else data}")
                    except Exception as e:
                        print(f"JSON parsing error: {e}")
                        print(f"Raw response: {response.text[:200]}")
            except Exception as e:
                print(f"Request error: {e}")

if __name__ == "__main__":
    asyncio.run(test_nse_endpoints())
