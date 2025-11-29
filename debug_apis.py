import asyncio
import httpx
import json

async def debug_most_active():
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }

    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            await client.get("https://www.nseindia.com", headers=headers)
            await asyncio.sleep(1)
        except:
            pass

        # Test Most Active
        print("=== MOST ACTIVE ===")
        response = await client.get("https://www.nseindia.com/api/live-analysis-most-active-securities?index=volume", headers=headers)
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Type: {type(data)}")
            if isinstance(data, dict):
                print(f"Keys: {data.keys()}")
                if 'data' in data:
                    print(f"First item: {json.dumps(data['data'][0], indent=2)}")
            else:
                print(f"First item: {json.dumps(data[0], indent=2)}")

        # Test 52-week high
        print("\n=== 52-WEEK HIGH ===")
        response2 = await client.get("https://www.nseindia.com/api/live-analysis-variations?index=gainers", headers=headers)
        print(f"Status: {response2.status_code}")
        if response2.status_code == 200:
            data2 = response2.json()
            print(f"Type: {type(data2)}")
            if isinstance(data2, dict):
                print(f"Keys: {data2.keys()}")
                if 'data' in data2:
                    print(f"First item: {json.dumps(data2['data'][0], indent=2)}")
            else:
                print(f"First item: {json.dumps(data2[0], indent=2)}")

if __name__ == "__main__":
    asyncio.run(debug_most_active())
