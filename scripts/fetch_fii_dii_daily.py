import asyncio

from database.connection import SessionLocal
from nse_data.fii_dii import fetch_fii_dii_data, store_daily_activity


async def main():
    data = await fetch_fii_dii_data()
    fii_data = None
    dii_data = None

    for item in data:
        if "FII" in item.get("category", ""):
            fii_data = item
        elif "DII" in item.get("category", ""):
            dii_data = item

    db = SessionLocal()
    try:
        store_daily_activity(db, fii_data, dii_data)
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
