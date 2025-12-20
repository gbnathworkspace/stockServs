from fastapi import APIRouter, HTTPException, Query

from services.market_data_service import get_candles


router = APIRouter(prefix="/market-data", tags=["Market Data"])


@router.get("/candles")
def get_candles_data(
    symbol: str = Query(..., min_length=1),
    interval: str = Query("5m"),
    period: str = Query("5d"),
):
    try:
        return get_candles(symbol=symbol, interval=interval, period=period)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to fetch market data")
