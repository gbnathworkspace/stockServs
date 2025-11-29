import asyncio
import httpx
import json

async def check_api_response():
    # Test the backend API directly
    async with httpx.AsyncClient() as client:
        print("=== Testing /nse_data/most-active-volume ===")
        response = await client.get("http://localhost:8000/nse_data/most-active-volume")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"\nResponse keys: {data.keys()}")
            if 'most_active' in data and len(data['most_active']) > 0:
                print(f"Number of items: {len(data['most_active'])}")
                print(f"\nFirst item keys: {data['most_active'][0].keys()}")
                print(f"\nFirst item full data:")
                print(json.dumps(data['most_active'][0], indent=2))
        
        print("\n\n=== Testing /nse_data/52-week-high ===")
        response2 = await client.get("http://localhost:8000/nse_data/52-week-high")
        print(f"Status: {response2.status_code}")
        if response2.status_code == 200:
            data2 = response2.json()
            print(f"\nResponse keys: {data2.keys()}")
            if 'stocks' in data2 and len(data2['stocks']) > 0:
                print(f"Number of items: {len(data2['stocks'])}")
                print(f"\nFirst item keys: {data2['stocks'][0].keys()}")
                print(f"\nFirst item full data:")
                print(json.dumps(data2['stocks'][0], indent=2))

if __name__ == "__main__":
    asyncio.run(check_api_response())
