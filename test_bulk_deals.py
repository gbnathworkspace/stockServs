import asyncio
import httpx
import json

async def check_bulk_deals():
    """Check the bulk deals API response"""
    async with httpx.AsyncClient() as client:
        print("Testing Bulk Deals...")
        try:
            response = await client.get("http://localhost:8000/nse_data/bulk-deals")
            if response.status_code == 200:
                data = response.json()
                print(f"Keys: {list(data.keys())}")
                
                if 'bulk_deals' in data:
                    deals = data['bulk_deals']
                    print(f"Deals type: {type(deals)}")
                    if isinstance(deals, list):
                        print(f"Count: {len(deals)}")
                        if len(deals) > 0:
                            print(f"First deal: {json.dumps(deals[0], indent=2)}")
                    else:
                        print(f"Deals content: {deals}")
                
                print(f"Date: {data.get('date')}")
            else:
                print(f"Failed with status {response.status_code}")
                print(f"Response: {response.text}")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_bulk_deals())
