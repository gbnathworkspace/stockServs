import asyncio
import httpx
import json

async def check_bulk_deals_keys():
    """Check the keys of bulk deals items"""
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get("http://localhost:8000/nse_data/bulk-deals")
            if response.status_code == 200:
                data = response.json()
                if 'bulk_deals' in data and len(data['bulk_deals']) > 0:
                    deal = data['bulk_deals'][0]
                    print(f"Keys: {list(deal.keys())}")
                    print(json.dumps(deal, indent=2))
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_bulk_deals_keys())
