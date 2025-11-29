import asyncio
import httpx
import json
from datetime import datetime, timedelta

async def test_nse_apis():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }

    # Date for bulk/block deals (today)
    today = datetime.now().strftime("%d-%m-%Y")
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%d-%m-%Y")

    apis_to_test = {
        "Bulk Deals": f"https://www.nseindia.com/api/historical/bulk-deals?from={yesterday}&to={today}",
        "Block Deals": f"https://www.nseindia.com/api/historical/block-deals?from={yesterday}&to={today}",
        "52 Week High": "https://www.nseindia.com/api/live-analysis-variations?index=gainers",
        "52 Week Low": "https://www.nseindia.com/api/live-analysis-variations?index=losers",
        "Most Active Value": "https://www.nseindia.com/api/live-analysis-most-active-securities?index=value",
        "Most Active Volume": "https://www.nseindia.com/api/live-analysis-most-active-securities?index=volume",
    }

    async with httpx.AsyncClient(follow_redirects=True) as client:
        # Get cookies
        try:
            await client.get("https://www.nseindia.com", headers=headers)
            await asyncio.sleep(1)
        except:
            pass

        for name, url in apis_to_test.items():
            print(f"\n{'='*60}")
            print(f"Testing: {name}")
            print(f"URL: {url}")
            print(f"{'='*60}")
            
            try:
                response = await client.get(url, headers=headers)
                print(f"Status: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    print(f"Response type: {type(data)}")
                    if isinstance(data, list):
                        print(f"Items count: {len(data)}")
                        if len(data) > 0:
                            print(f"First item: {json.dumps(data[0], indent=2)}")
                    elif isinstance(data, dict):
                        print(f"Keys: {data.keys()}")
                        print(f"Sample: {json.dumps(data, indent=2)[:500]}")
                else:
                    print(f"Failed: {response.text[:200]}")
            except Exception as e:
                print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(test_nse_apis())
