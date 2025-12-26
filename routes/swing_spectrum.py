"""
Swing Spectrum API Routes - Medium-term swing trade opportunities.

Endpoints:
- GET /swing-spectrum/breakouts - 52-week high/low breakouts
- GET /swing-spectrum/stock/{symbol}/analysis - Analyze specific stock
- GET /swing-spectrum/daily-summary - Daily swing opportunities summary
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date
import json

from routes.deps import get_db
from services.swing_spectrum_service import SwingSpectrumService
from services.cache import cache, TTL_NSE_DATA
from database.models import SwingSpectrumDailySummary

router = APIRouter()


@router.get("/breakouts")
async def get_breakouts(
    type: str = Query("high", description="Breakout type: high (52W high) or low (52W low)"),
    min_strength: str = Query(None, description="Filter by strength: STRONG, MODERATE, WEAK"),
    db: Session = Depends(get_db)
):
    """
    Get stocks at or near 52-week high/low breakouts.

    Types:
    - high: Stocks near 52-week high (bullish breakouts)
    - low: Stocks near 52-week low (potential reversals)

    Strength levels:
    - STRONG: Within 2-5% of target with good momentum
    - MODERATE: Within 5-10% with decent momentum
    - WEAK: Further from target or weak momentum
    """
    cache_key = f"swing_spectrum_breakouts_{type}_{min_strength}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    service = SwingSpectrumService(db)

    try:
        if type not in ["high", "low"]:
            raise HTTPException(status_code=400, detail="Invalid type. Use 'high' or 'low'")

        breakouts = await service.get_52w_breakouts(breakout_type=type)

        # Filter by strength if specified
        if min_strength:
            min_strength = min_strength.upper()
            if min_strength not in ["STRONG", "MODERATE", "WEAK"]:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid strength. Use 'STRONG', 'MODERATE', or 'WEAK'"
                )

            # Define strength order
            strength_order = {"STRONG": 3, "MODERATE": 2, "WEAK": 1}
            min_level = strength_order[min_strength]

            breakouts = [
                b for b in breakouts
                if strength_order.get(b["strength"], 0) >= min_level
            ]

        result = {
            "breakouts": breakouts,
            "count": len(breakouts),
            "type": type,
            "filter": {
                "min_strength": min_strength
            }
        }

        # Cache for 30 seconds
        cache.set(cache_key, result, TTL_NSE_DATA)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching breakouts: {str(e)}")


@router.get("/stock/{symbol}/analysis")
async def analyze_stock(
    symbol: str,
    db: Session = Depends(get_db)
):
    """
    Analyze a specific stock for swing trading opportunities.

    Returns:
    - Current breakout status
    - Distance from 52W high/low
    - Breakout strength
    - Swing trading signal
    """
    cache_key = f"swing_spectrum_analysis_{symbol}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    service = SwingSpectrumService(db)

    try:
        analysis = await service.analyze_stock(symbol.upper())

        if not analysis:
            raise HTTPException(
                status_code=404,
                detail=f"Stock {symbol} not found in current breakout data"
            )

        # Cache for 30 seconds
        cache.set(cache_key, analysis, TTL_NSE_DATA)
        return analysis

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error analyzing stock: {str(e)}")


@router.get("/daily-summary")
async def get_daily_summary(
    trade_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format (default: today)"),
    db: Session = Depends(get_db)
):
    """
    Get end-of-day Swing Spectrum summary.

    Shows top 52W high and low breakouts with strong signals.
    Available after market close.
    """
    try:
        if trade_date:
            target_date = date.fromisoformat(trade_date)
        else:
            target_date = date.today()

        summary = db.query(SwingSpectrumDailySummary).filter(
            SwingSpectrumDailySummary.trade_date == target_date
        ).first()

        if not summary:
            # If no summary for today, generate it on-demand
            if target_date == date.today():
                service = SwingSpectrumService(db)
                await service.generate_daily_summary(target_date)

                # Fetch again
                summary = db.query(SwingSpectrumDailySummary).filter(
                    SwingSpectrumDailySummary.trade_date == target_date
                ).first()

        if not summary:
            raise HTTPException(
                status_code=404,
                detail=f"No Swing Spectrum summary available for {target_date}"
            )

        # Parse JSON fields
        result = {
            "trade_date": summary.trade_date.isoformat(),
            "top_52w_highs": json.loads(summary.top_52w_highs) if summary.top_52w_highs else [],
            "top_52w_lows": json.loads(summary.top_52w_lows) if summary.top_52w_lows else [],
            "total_52w_highs": summary.total_52w_highs or 0,
            "total_52w_lows": summary.total_52w_lows or 0,
        }

        return result

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching daily summary: {str(e)}")


@router.get("/momentum")
async def get_momentum_stocks(
    min_change: float = Query(3.0, description="Minimum price change % (default: 3%)"),
    db: Session = Depends(get_db)
):
    """
    Get stocks with strong momentum near breakout levels.

    Combines:
    - 52W high proximity
    - Strong price momentum (>3%)
    - Potential swing trade setups
    """
    cache_key = f"swing_spectrum_momentum_{min_change}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    service = SwingSpectrumService(db)

    try:
        # Get 52W high breakouts
        breakouts = await service.get_52w_breakouts("high")

        # Filter for strong momentum
        momentum_stocks = [
            stock for stock in breakouts
            if stock["priceChangePct"] >= min_change
        ]

        # Sort by momentum (price change %)
        momentum_stocks.sort(key=lambda x: x["priceChangePct"], reverse=True)

        result = {
            "momentum_stocks": momentum_stocks,
            "count": len(momentum_stocks),
            "min_change_pct": min_change
        }

        # Cache for 30 seconds
        cache.set(cache_key, result, TTL_NSE_DATA)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching momentum stocks: {str(e)}")


@router.post("/admin/store-snapshot")
async def admin_store_snapshot(db: Session = Depends(get_db)):
    """
    Admin endpoint to manually store breakout snapshot.
    """
    try:
        service = SwingSpectrumService(db)
        count = await service.store_breakout_snapshot()
        return {
            "status": "success",
            "message": f"Stored {count} breakout snapshots"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error storing snapshot: {str(e)}")


@router.post("/admin/generate-summary")
async def admin_generate_summary(db: Session = Depends(get_db)):
    """
    Admin endpoint to generate daily summary.
    """
    try:
        service = SwingSpectrumService(db)
        success = await service.generate_daily_summary()
        return {
            "status": "success" if success else "failed",
            "message": "Daily summary generated" if success else "Failed to generate summary"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating summary: {str(e)}")
