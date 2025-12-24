"""
Option Clock API Endpoints
Provides OI-based market timing data for NIFTY and BANKNIFTY.
"""

from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel

from routes.deps import get_current_user
from services.option_clock_service import option_clock_service
from database.connection import SessionLocal
from database.models import OptionClockSnapshot, OptionClockDailySummary

router = APIRouter(prefix="/option-clock", tags=["Option Clock"])


class SnapshotResponse(BaseModel):
    id: int
    timestamp: str
    symbol: str
    expiry_date: str
    total_call_oi: Optional[float]
    total_put_oi: Optional[float]
    call_oi_change: Optional[float]
    put_oi_change: Optional[float]
    pcr: Optional[float]
    pcr_change: Optional[float]
    spot_price: Optional[float]
    price_change: Optional[float]
    price_change_pct: Optional[float]
    signal: Optional[str]
    signal_strength: Optional[str]
    max_pain_strike: Optional[float]
    highest_call_oi_strike: Optional[float]
    highest_put_oi_strike: Optional[float]
    strike_data: Optional[dict]


class DailySummaryResponse(BaseModel):
    id: int
    trade_date: str
    symbol: str
    expiry_date: str
    opening_pcr: Optional[float]
    closing_pcr: Optional[float]
    opening_spot: Optional[float]
    closing_spot: Optional[float]
    spot_day_change: Optional[float]
    spot_day_change_pct: Optional[float]
    call_oi_day_change: Optional[float]
    put_oi_day_change: Optional[float]
    max_pain_strike: Optional[float]
    dominant_signal: Optional[str]


@router.get("/latest/{symbol}")
async def get_latest_snapshot(
    symbol: str,
    user: dict = Depends(get_current_user)
):
    """
    Get the latest Option Clock snapshot for NIFTY or BANKNIFTY.
    """
    symbol = symbol.upper()
    if symbol not in ["NIFTY", "BANKNIFTY"]:
        raise HTTPException(status_code=400, detail="Symbol must be NIFTY or BANKNIFTY")

    snapshot = option_clock_service.get_latest_snapshot(symbol)
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"No snapshot found for {symbol}")

    return snapshot


@router.get("/intraday/{symbol}")
async def get_intraday_snapshots(
    symbol: str,
    trade_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format"),
    user: dict = Depends(get_current_user)
):
    """
    Get all intraday snapshots for a given day (for charting PCR over time).
    Defaults to today if no date provided.
    """
    symbol = symbol.upper()
    if symbol not in ["NIFTY", "BANKNIFTY"]:
        raise HTTPException(status_code=400, detail="Symbol must be NIFTY or BANKNIFTY")

    target_date = None
    if trade_date:
        try:
            target_date = datetime.strptime(trade_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    else:
        target_date = date.today()

    snapshots = option_clock_service.get_intraday_snapshots(symbol, target_date)
    return {
        "symbol": symbol,
        "trade_date": target_date.isoformat(),
        "snapshots": snapshots,
        "count": len(snapshots)
    }


@router.get("/daily-summary/{symbol}")
async def get_daily_summaries(
    symbol: str,
    days: int = Query(7, ge=1, le=30, description="Number of days of history"),
    user: dict = Depends(get_current_user)
):
    """
    Get daily summaries for historical analysis.
    """
    symbol = symbol.upper()
    if symbol not in ["NIFTY", "BANKNIFTY"]:
        raise HTTPException(status_code=400, detail="Symbol must be NIFTY or BANKNIFTY")

    db = SessionLocal()
    try:
        summaries = (
            db.query(OptionClockDailySummary)
            .filter(OptionClockDailySummary.symbol == symbol)
            .order_by(OptionClockDailySummary.trade_date.desc())
            .limit(days)
            .all()
        )

        return {
            "symbol": symbol,
            "summaries": [
                {
                    "trade_date": s.trade_date.isoformat(),
                    "opening_pcr": s.opening_pcr,
                    "closing_pcr": s.closing_pcr,
                    "opening_spot": s.opening_spot,
                    "closing_spot": s.closing_spot,
                    "spot_day_change": s.spot_day_change,
                    "spot_day_change_pct": s.spot_day_change_pct,
                    "call_oi_day_change": s.call_oi_day_change,
                    "put_oi_day_change": s.put_oi_day_change,
                    "max_pain_strike": s.max_pain_strike,
                    "dominant_signal": s.dominant_signal
                }
                for s in summaries
            ]
        }
    finally:
        db.close()


@router.get("/signals/{symbol}")
async def get_signal_history(
    symbol: str,
    limit: int = Query(20, ge=1, le=100, description="Number of signals to return"),
    user: dict = Depends(get_current_user)
):
    """
    Get recent signal history with timestamps.
    Useful for understanding market direction over time.
    """
    symbol = symbol.upper()
    if symbol not in ["NIFTY", "BANKNIFTY"]:
        raise HTTPException(status_code=400, detail="Symbol must be NIFTY or BANKNIFTY")

    db = SessionLocal()
    try:
        snapshots = (
            db.query(OptionClockSnapshot)
            .filter(OptionClockSnapshot.symbol == symbol)
            .order_by(OptionClockSnapshot.timestamp.desc())
            .limit(limit)
            .all()
        )

        return {
            "symbol": symbol,
            "signals": [
                {
                    "timestamp": s.timestamp.isoformat(),
                    "signal": s.signal,
                    "signal_strength": s.signal_strength,
                    "pcr": s.pcr,
                    "spot_price": s.spot_price,
                    "price_change": s.price_change
                }
                for s in snapshots
            ]
        }
    finally:
        db.close()


@router.get("/strike-analysis/{symbol}")
async def get_strike_analysis(
    symbol: str,
    user: dict = Depends(get_current_user)
):
    """
    Get detailed strike-wise OI breakdown from the latest snapshot.
    Shows which strikes have highest call/put OI for support/resistance levels.
    """
    symbol = symbol.upper()
    if symbol not in ["NIFTY", "BANKNIFTY"]:
        raise HTTPException(status_code=400, detail="Symbol must be NIFTY or BANKNIFTY")

    snapshot = option_clock_service.get_latest_snapshot(symbol)
    if not snapshot:
        raise HTTPException(status_code=404, detail=f"No snapshot found for {symbol}")

    strike_data = snapshot.get("strike_data", {})
    if not strike_data:
        return {
            "symbol": symbol,
            "message": "No strike data available",
            "strikes": []
        }

    # Sort strikes and prepare analysis
    strikes = sorted(strike_data.keys(), key=lambda x: float(x))
    spot_price = snapshot.get("spot_price", 0)

    analysis = []
    for strike in strikes:
        data = strike_data[str(strike)]
        strike_float = float(strike)
        analysis.append({
            "strike": strike_float,
            "call_oi": data.get("call_oi", 0),
            "put_oi": data.get("put_oi", 0),
            "call_oi_change": data.get("call_oi_change", 0),
            "put_oi_change": data.get("put_oi_change", 0),
            "is_atm": abs(strike_float - spot_price) <= 50,
            "is_resistance": data.get("call_oi", 0) > data.get("put_oi", 0),
            "is_support": data.get("put_oi", 0) > data.get("call_oi", 0)
        })

    return {
        "symbol": symbol,
        "spot_price": spot_price,
        "max_pain": snapshot.get("max_pain_strike"),
        "highest_call_oi_strike": snapshot.get("highest_call_oi_strike"),
        "highest_put_oi_strike": snapshot.get("highest_put_oi_strike"),
        "strikes": analysis
    }


@router.post("/fetch")
async def trigger_fetch(
    symbol: str = Query("NIFTY", description="Symbol to fetch (NIFTY or BANKNIFTY)"),
    user: dict = Depends(get_current_user)
):
    """
    Manually trigger an Option Clock fetch for the specified symbol.
    Requires authentication.
    """
    symbol = symbol.upper()
    if symbol not in ["NIFTY", "BANKNIFTY"]:
        raise HTTPException(status_code=400, detail="Symbol must be NIFTY or BANKNIFTY")

    access_token = option_clock_service.get_system_access_token()
    if not access_token:
        raise HTTPException(
            status_code=503,
            detail="No Fyers access token available. Please connect a Fyers account first."
        )

    snapshot = option_clock_service.create_snapshot(access_token, symbol)
    if not snapshot:
        raise HTTPException(status_code=500, detail="Failed to create snapshot")

    return {
        "message": f"Snapshot created for {symbol}",
        "snapshot_id": snapshot.id,
        "timestamp": snapshot.timestamp.isoformat(),
        "signal": snapshot.signal,
        "pcr": snapshot.pcr
    }


@router.get("/overview")
async def get_overview(
    user: dict = Depends(get_current_user)
):
    """
    Get a quick overview of both NIFTY and BANKNIFTY for dashboard display.
    """
    nifty = option_clock_service.get_latest_snapshot("NIFTY")
    banknifty = option_clock_service.get_latest_snapshot("BANKNIFTY")

    def format_snapshot(s):
        if not s:
            return None
        return {
            "timestamp": s.get("timestamp"),
            "spot_price": s.get("spot_price"),
            "price_change": s.get("price_change"),
            "price_change_pct": s.get("price_change_pct"),
            "pcr": s.get("pcr"),
            "signal": s.get("signal"),
            "signal_strength": s.get("signal_strength"),
            "max_pain_strike": s.get("max_pain_strike")
        }

    return {
        "nifty": format_snapshot(nifty),
        "banknifty": format_snapshot(banknifty),
        "last_updated": datetime.now().isoformat()
    }
