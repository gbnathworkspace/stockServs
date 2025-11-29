import asyncio
import httpx
import json

async def check_api_response():
    """Check the API responses and save to file"""
    async with httpx.AsyncClient() as client:
        results = {}
        
        # Test Most Active Volume
        print("Testing Most Active Volume...")
        try:
            response = await client.get("http://localhost:8000/nse_data/most-active-volume")
            if response.status_code == 200:
                data = response.json()
                results['most_active_volume'] = data
                if 'most_active' in data and len(data['most_active']) > 0:
                    print(f"✓ Most Active Volume returned {len(data['most_active'])} items")
                    print(f"  Sample keys: {list(data['most_active'][0].keys())[:5]}")
                else:
                    print("✗ Most Active Volume returned empty data")
            else:
                print(f"✗ Most Active Volume failed with status {response.status_code}")
        except Exception as e:
            print(f"✗ Most Active Volume error: {e}")
            results['most_active_volume_error'] = str(e)
        
        # Test 52-Week High
        print("\nTesting 52-Week High...")
        try:
            response = await client.get("http://localhost:8000/nse_data/52-week-high")
            if response.status_code == 200:
                data = response.json()
                results['52_week_high'] = data
                if 'stocks' in data and len(data['stocks']) > 0:
                    print(f"✓ 52-Week High returned {len(data['stocks'])} items")
                    print(f"  Sample keys: {list(data['stocks'][0].keys())[:5]}")
                else:
                    print("✗ 52-Week High returned empty data")
            else:
                print(f"✗ 52-Week High failed with status {response.status_code}")
        except Exception as e:
            print(f"✗ 52-Week High error: {e}")
            results['52_week_high_error'] = str(e)
        
        # Save to file
        with open('api_responses.json', 'w') as f:
            json.dump(results, f, indent=2)
        print("\n✓ Results saved to api_responses.json")

if __name__ == "__main__":
    asyncio.run(check_api_response())
