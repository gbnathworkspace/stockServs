import asyncio
import httpx
import json

async def check_keys():
    async with httpx.AsyncClient() as client:
        r = await client.get("http://localhost:8000/nse_data/bulk-deals")
        data = r.json()
        if 'bulk_deals' in data and len(data['bulk_deals']) > 0:
            print(list(data['bulk_deals'][0].keys()))

if __name__ == "__main__":
    asyncio.run(check_keys())
