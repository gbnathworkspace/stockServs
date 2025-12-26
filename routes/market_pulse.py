"""
Market Pulse API Routes - Smart money flow and institutional activity detection.

Endpoints:
- GET /market-pulse/screener - Multi-filter screener
- GET /market-pulse/volume-surge - Stocks with volume >2x average
- GET /market-pulse/delivery-leaders - High delivery % stocks
- GET /market-pulse/block-activity - Bulk/block deal tracker
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date, timedelta
import json

from routes.deps import get_db
from services.market_pulse_service import MarketPulseService
from services.cache import cache, TTL_NSE_DATA
from database.models import MarketPulseDailySummary

router = APIRouter()


@router.get("/screener")
async def market_pulse_screener(
    filter: str = Query("volume", description="Filter type: volume, smart-money, delivery"),
    min_surge: float = Query(2.0, description="Minimum volume surge ratio"),
    min_delivery: float = Query(60.0, description="Minimum delivery percentage"),
    db: Session = Depends(get_db)
):
    """
    Multi-filter Market Pulse screener.

    Filters:
    - volume: Volume surge detection
    - smart-money: Bulk/block deal activity
    - delivery: High delivery % stocks
    """
    cache_key = f"market_pulse_screener_{filter}_{min_surge}_{min_delivery}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    service = MarketPulseService(db)

    try:
        if filter == "volume":
            results = await service.detect_volume_surges(min_surge_ratio=min_surge)
            data = {
                "filter": "volume",
                "stocks": results,
                "count": len(results),
                "criteria": f"Volume surge >{min_surge}x average"
            }

        elif filter == "delivery":
            results = await service.get_delivery_leaders(min_delivery_pct=min_delivery)
            data = {
                "filter": "delivery",
                "stocks": results,
                "count": len(results),
                "criteria": f"Delivery >{min_delivery}%"
            }

        elif filter == "smart-money":
            results = service.get_bulk_activity(days=1)
            # Group by symbol and calculate net flow
            symbol_flow = {}
            for deal in results:
                symbol = deal["symbol"]
                value = deal["value"] if deal["buySell"] == "BUY" else -deal["value"]

                if symbol not in symbol_flow:
                    symbol_flow[symbol] = {
                        "symbol": symbol,
                        "buyValue": 0,
                        "sellValue": 0,
                        "netFlow": 0,
                        "dealCount": 0
                    }

                if deal["buySell"] == "BUY":
                    symbol_flow[symbol]["buyValue"] += deal["value"]
                else:
                    symbol_flow[symbol]["sellValue"] += deal["value"]

                symbol_flow[symbol]["netFlow"] += value
                symbol_flow[symbol]["dealCount"] += 1

            # Convert to list and sort by net flow
            smart_money = list(symbol_flow.values())
            smart_money.sort(key=lambda x: abs(x["netFlow"]), reverse=True)

            data = {
                "filter": "smart-money",
                "stocks": smart_money[:20],
                "count": len(smart_money),
                "criteria": "Bulk/Block deal activity"
            }

        else:
            raise HTTPException(status_code=400, detail="Invalid filter. Use: volume, smart-money, or delivery")

        # Cache for 30 seconds
        cache.set(cache_key, data, TTL_NSE_DATA)
        return data

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error in screener: {str(e)}")


@router.get("/volume-surge")
async def get_volume_surge(
    min_ratio: float = Query(2.0, description="Minimum surge ratio (default: 2.0x)"),
    db: Session = Depends(get_db)
):
    """
    Get stocks with volume surge >2x average.
    Indicates increased institutional or retail interest.
    """
    cache_key = f"volume_surge_{min_ratio}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    service = MarketPulseService(db)

    try:
        surges = await service.detect_volume_surges(min_surge_ratio=min_ratio)

        result = {
            "volume_surges": surges,
            "count": len(surges),
            "min_ratio": min_ratio,
            "timestamp": date.today().isoformat()
        }

        # Cache for 30 seconds
        cache.set(cache_key, result, TTL_NSE_DATA)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching volume surges: {str(e)}")


@router.get("/delivery-leaders")
async def get_delivery_leaders(
    min_pct: float = Query(60.0, description="Minimum delivery % (default: 60%)"),
    db: Session = Depends(get_db)
):
    """
    Get stocks with high delivery percentage (>60%).
    High delivery indicates strong investor conviction and cash market buying.
    """
    cache_key = f"delivery_leaders_{min_pct}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    service = MarketPulseService(db)

    try:
        leaders = await service.get_delivery_leaders(min_delivery_pct=min_pct)

        result = {
            "delivery_leaders": leaders,
            "count": len(leaders),
            "min_delivery_pct": min_pct,
            "timestamp": date.today().isoformat()
        }

        # Cache for 30 seconds
        cache.set(cache_key, result, TTL_NSE_DATA)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching delivery leaders: {str(e)}")


@router.get("/block-activity")
async def get_block_activity(
    symbol: Optional[str] = Query(None, description="Filter by symbol (optional)"),
    days: int = Query(1, description="Number of days to look back (default: 1)"),
    db: Session = Depends(get_db)
):
    """
    Get bulk and block deal activity.
    Shows institutional buying/selling through large deals.
    """
    cache_key = f"block_activity_{symbol}_{days}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    service = MarketPulseService(db)

    try:
        deals = service.get_bulk_activity(symbol=symbol, days=days)

        # Calculate aggregate stats
        bulk_deals = [d for d in deals if d["dealType"] == "BULK"]
        block_deals = [d for d in deals if d["dealType"] == "BLOCK"]

        total_buy_value = sum(d["value"] for d in deals if d["buySell"] == "BUY")
        total_sell_value = sum(d["value"] for d in deals if d["buySell"] == "SELL")

        result = {
            "deals": deals[:50],  # Limit to 50 most recent
            "total_count": len(deals),
            "bulk_count": len(bulk_deals),
            "block_count": len(block_deals),
            "total_buy_value": round(total_buy_value / 10000000, 2),  # In crores
            "total_sell_value": round(total_sell_value / 10000000, 2),
            "net_flow": round((total_buy_value - total_sell_value) / 10000000, 2),
            "days": days,
            "symbol": symbol
        }

        # Cache for 30 seconds
        cache.set(cache_key, result, TTL_NSE_DATA)
        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching block activity: {str(e)}")


@router.get("/daily-summary")
async def get_daily_summary(
    trade_date: Optional[str] = Query(None, description="Date in YYYY-MM-DD format (default: today)"),
    db: Session = Depends(get_db)
):
    """
    Get end-of-day Market Pulse summary.
    Available after market close - shows top volume surges, delivery leaders, and smart money flow.
    """
    try:
        if trade_date:
            target_date = date.fromisoformat(trade_date)
        else:
            target_date = date.today()

        summary = db.query(MarketPulseDailySummary).filter(
            MarketPulseDailySummary.trade_date == target_date
        ).first()

        if not summary:
            # If no summary for today, generate it on-demand
            if target_date == date.today():
                service = MarketPulseService(db)
                await service.generate_daily_summary(target_date)

                # Fetch again
                summary = db.query(MarketPulseDailySummary).filter(
                    MarketPulseDailySummary.trade_date == target_date
                ).first()

        if not summary:
            raise HTTPException(
                status_code=404,
                detail=f"No Market Pulse summary available for {target_date}"
            )

        # Parse JSON fields
        result = {
            "trade_date": summary.trade_date.isoformat(),
            "top_volume_surges": json.loads(summary.top_volume_surges) if summary.top_volume_surges else [],
            "top_delivery_stocks": json.loads(summary.top_delivery_stocks) if summary.top_delivery_stocks else [],
            "bulk_deal_stats": {
                "total_bulk_deals": summary.total_bulk_deals or 0,
                "total_block_deals": summary.total_block_deals or 0,
                "bulk_buy_value_cr": round((summary.bulk_buy_value or 0) / 10000000, 2),
                "bulk_sell_value_cr": round((summary.bulk_sell_value or 0) / 10000000, 2),
                "net_institutional_flow_cr": round((summary.net_institutional_flow or 0) / 10000000, 2)
            }
        }

        return result

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching daily summary: {str(e)}")


@router.post("/admin/generate-snapshot")
async def admin_generate_snapshot(db: Session = Depends(get_db)):
    """
    Admin endpoint to manually trigger Market Pulse snapshot generation.
    Used for testing or on-demand snapshots.
    """
    try:
        service = MarketPulseService(db)
        await service.generate_snapshot()
        return {"status": "success", "message": "Market Pulse snapshot generated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating snapshot: {str(e)}")


@router.post("/admin/update-baselines")
async def admin_update_baselines(db: Session = Depends(get_db)):
    """
    Admin endpoint to update volume baselines.
    Should be called daily after market close.
    """
    try:
        service = MarketPulseService(db)
        await service.update_volume_baselines()
        return {"status": "success", "message": "Volume baselines updated"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error updating baselines: {str(e)}")


@router.post("/admin/fetch-bulk-deals")
async def admin_fetch_bulk_deals(db: Session = Depends(get_db)):
    """
    Admin endpoint to fetch and store bulk/block deals.
    """
    try:
        service = MarketPulseService(db)
        result = await service.fetch_and_store_bulk_deals()
        return {"status": "success", "deals_stored": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching bulk deals: {str(e)}")
