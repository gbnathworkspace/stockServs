from fastapi import APIRouter, HTTPException, Depends
import httpx
import asyncio
from datetime import datetime
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import FiiDiiActivity

router = APIRouter()

NSE_FII_DII_URL = "https://www.nseindia.com/api/fiidiiTradeReact"

async def fetch_fii_dii_data():
    """Helper function to fetch FII/DII activity data from NSE"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }

    async with httpx.AsyncClient(follow_redirects=True) as client:
        try:
            # Try to get cookies
            try:
                await client.get("https://www.nseindia.com", headers=headers)
                await asyncio.sleep(0.5)
            except Exception:
                pass

            response = await client.get(NSE_FII_DII_URL, headers=headers)
            response.raise_for_status()
            data = response.json()
            return data
        except Exception as e:
            print(f"Error fetching FII/DII data: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")

@router.get("/fii-dii-activity")
async def get_fii_dii_activity(db: Session = Depends(get_db)):
    """Fetch FII/DII activity data (buy/sell values and net flows)"""
    data = await fetch_fii_dii_data()
    
    # Parse the response to separate FII and DII data
    fii_data = None
    dii_data = None
    
    for item in data:
        if "FII" in item.get("category", ""):
            fii_data = item
        elif "DII" in item.get("category", ""):
            dii_data = item

    store_daily_activity(db, fii_data, dii_data)

    return {
        "fii": fii_data,
        "dii": dii_data,
        "date": fii_data.get("date") if fii_data else None
    }


def parse_numeric(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    text = str(value).strip()
    if not text or text == "--":
        return None
    return float(text.replace(",", ""))


def parse_trade_date(value):
    if not value:
        return None
    text = str(value).strip()
    for fmt in ("%d-%b-%Y", "%d-%b-%Y %H:%M:%S", "%d-%m-%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def store_daily_activity(db: Session, fii_data, dii_data):
    date_str = None
    if fii_data and fii_data.get("date"):
        date_str = fii_data.get("date")
    elif dii_data and dii_data.get("date"):
        date_str = dii_data.get("date")

    trade_date = parse_trade_date(date_str)
    if not trade_date:
        return

    record = (
        db.query(FiiDiiActivity)
        .filter(FiiDiiActivity.trade_date == trade_date)
        .first()
    )

    if record is None:
        record = FiiDiiActivity(trade_date=trade_date)
        db.add(record)

    if fii_data:
        record.fii_buy_value = parse_numeric(fii_data.get("buyValue"))
        record.fii_sell_value = parse_numeric(fii_data.get("sellValue"))
        record.fii_net_value = parse_numeric(fii_data.get("netValue"))
    if dii_data:
        record.dii_buy_value = parse_numeric(dii_data.get("buyValue"))
        record.dii_sell_value = parse_numeric(dii_data.get("sellValue"))
        record.dii_net_value = parse_numeric(dii_data.get("netValue"))

    record.source_date_str = date_str
    try:
        db.commit()
    except Exception:
        db.rollback()
