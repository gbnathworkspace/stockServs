from fastapi import APIRouter, HTTPException, Depends, Query
import httpx
import asyncio
from datetime import datetime
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import FiiDiiActivity
from services.cache import cache

router = APIRouter()

NSE_FII_DII_URL = "https://www.nseindia.com/api/fiidiiTradeReact"

# In-flight lock to prevent concurrent duplicate fetches
_fii_dii_lock: asyncio.Lock | None = None
_RAW_FII_DII_TTL = 300  # 5 minutes for raw data


async def fetch_fii_dii_data():
    """Helper function to fetch FII/DII activity data from NSE.

    Uses raw-data cache + in-flight deduplication so that triple calls
    from the frontend only trigger a single HTTP request.
    """
    global _fii_dii_lock
    raw_cache_key = "nse_raw:fii_dii"

    # Fast path: serve from raw cache
    cached = cache.get(raw_cache_key)
    if cached is not None:
        return cached

    if _fii_dii_lock is None:
        _fii_dii_lock = asyncio.Lock()

    async with _fii_dii_lock:
        # Double-check after acquiring lock
        cached = cache.get(raw_cache_key)
        if cached is not None:
            return cached

        data = await _do_fetch_fii_dii()
        cache.set(raw_cache_key, data, _RAW_FII_DII_TTL)
        return data


async def _do_fetch_fii_dii():
    """Perform the actual HTTP call to NSE for FII/DII data."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/"
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
        try:
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

def extract_fii_dii_records(data):
    if not isinstance(data, list):
        return None, None

    fii_data = None
    dii_data = None

    for item in data:
        if "FII" in item.get("category", ""):
            fii_data = item
        elif "DII" in item.get("category", ""):
            dii_data = item

    return fii_data, dii_data

@router.get("/fii-dii-activity")
async def get_fii_dii_activity(db: Session = Depends(get_db)):
    """Fetch FII/DII activity data (buy/sell values and net flows)"""
    # Import at function level to avoid circular imports
    from services.cache import cache, fii_dii_activity_key, TTL_FII_DII
    
    # Check cache first
    cached = cache.get(fii_dii_activity_key())
    if cached is not None:
        return cached
    
    # Fetch fresh data
    data = await fetch_fii_dii_data()
    
    # Parse the response to separate FII and DII data
    fii_data, dii_data = extract_fii_dii_records(data)

    store_daily_activity(db, fii_data, dii_data)

    result = {
        "fii": fii_data,
        "dii": dii_data,
        "date": fii_data.get("date") if fii_data else None
    }
    
    # Cache for 10 minutes
    cache.set(fii_dii_activity_key(), result, TTL_FII_DII)
    
    return result


@router.get("/fii-dii-history")
async def get_fii_dii_history(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    total = db.query(FiiDiiActivity).count()
    records = (
        db.query(FiiDiiActivity)
        .order_by(FiiDiiActivity.trade_date.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "records": [serialize_activity(record) for record in records],
    }


@router.get("/fii-dii-history/date")
async def get_fii_dii_by_date(
    date: str,
    db: Session = Depends(get_db),
):
    trade_date = parse_trade_date(date)
    if not trade_date:
        raise HTTPException(status_code=400, detail="Invalid date format")
    record = (
        db.query(FiiDiiActivity)
        .filter(FiiDiiActivity.trade_date == trade_date)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="No activity for that date")
    return {"record": serialize_activity(record)}


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
    for fmt in ("%d-%b-%Y", "%d-%b-%Y %H:%M:%S", "%d-%m-%Y", "%Y-%m-%d"):
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


@router.post("/fii-dii-backfill")
async def backfill_fii_dii(
    records: list,
    db: Session = Depends(get_db),
):
    """Bulk import historical FII/DII records.
    Each record: {trade_date, fii_buy_value, fii_sell_value, fii_net_value,
                   dii_buy_value, dii_sell_value, dii_net_value}
    """
    inserted = 0
    skipped = 0
    for rec in records:
        trade_date = parse_trade_date(rec.get("trade_date"))
        if not trade_date:
            skipped += 1
            continue
        existing = (
            db.query(FiiDiiActivity)
            .filter(FiiDiiActivity.trade_date == trade_date)
            .first()
        )
        if existing:
            skipped += 1
            continue
        activity = FiiDiiActivity(
            trade_date=trade_date,
            fii_buy_value=parse_numeric(rec.get("fii_buy_value")),
            fii_sell_value=parse_numeric(rec.get("fii_sell_value")),
            fii_net_value=parse_numeric(rec.get("fii_net_value")),
            dii_buy_value=parse_numeric(rec.get("dii_buy_value")),
            dii_sell_value=parse_numeric(rec.get("dii_sell_value")),
            dii_net_value=parse_numeric(rec.get("dii_net_value")),
            source_date_str=rec.get("trade_date"),
        )
        db.add(activity)
        inserted += 1
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to save records")
    return {"inserted": inserted, "skipped": skipped}


def serialize_activity(record: FiiDiiActivity) -> dict:
    return {
        "trade_date": record.trade_date.isoformat() if record.trade_date else None,
        "fii_buy_value": record.fii_buy_value,
        "fii_sell_value": record.fii_sell_value,
        "fii_net_value": record.fii_net_value,
        "dii_buy_value": record.dii_buy_value,
        "dii_sell_value": record.dii_sell_value,
        "dii_net_value": record.dii_net_value,
        "source_date_str": record.source_date_str,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }
