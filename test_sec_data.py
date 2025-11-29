import asyncio
import httpx
import json

async def explore_sec_gtr20():
    """Explore SecGtr20 which might be 52-week high data"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }
    
    async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
        # Get cookies first
        try:
            await client.get("https://www.nseindia.com", headers=headers)
            await asyncio.sleep(0.5)
        except:
            pass
        
        # Test gainers endpoint
        print("Fetching gainers endpoint...")
        try:
            url = "https://www.nseindia.com/api/live-analysis-variations?index=gainers"
            response = await client.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                
                # Check SecGtr20
                if 'SecGtr20' in data:
                    sec_gtr20 = data['SecGtr20']
                    print(f"\nSecGtr20 structure:")
                    print(f"  Keys: {list(sec_gtr20.keys())}")
                    if 'data' in sec_gtr20:
                        stock_data = sec_gtr20['data']
                        print(f"  Data type: {type(stock_data)}")
                        if isinstance(stock_data, list):
                            print(f"  Number of stocks: {len(stock_data)}")
                            if len(stock_data) > 0:
                                print(f"\n  First stock:")
                                print(json.dumps(stock_data[0], indent=4))
                        
                # Check SecLwr20           
                if 'SecLwr20' in data:
                    sec_lwr20 = data['SecLwr20']
                    print(f"\nSecLwr20 structure:")
                    print(f"  Keys: {list(sec_lwr20.keys())}")
                    if 'data' in sec_lwr20:
                        stock_data = sec_lwr20['data']
                        print(f"  Data type: {type(stock_data)}")
                        if isinstance(stock_data, list):
                            print(f"  Number of stocks: {len(stock_data)}")
                            if len(stock_data) > 0:
                                print(f"\n  First stock:")
                                print(json.dumps(stock_data[0], indent=4))
                    
        except Exception as e:
            print(f"Error: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(explore_sec_gtr20())
