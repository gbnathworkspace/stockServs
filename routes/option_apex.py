"""
Option Apex API Routes - Real-time option candle analysis.

Endpoints:
- GET /option-apex/candles/{symbol} - Get candle data for charting
- GET /option-apex/signals/active - Active entry/exit signals
- GET /option-apex/flow/{symbol} - Institutional flow analysis
- GET /option-apex/iv-history/{symbol} - IV tracking history
- POST /option-apex/admin/analyze - Generate signal for option
"""
from fastapi import APIRouter, Depends, Query, HTTPException, Path
from sqlalchemy.orm import Session
from typing import Optional
from datetime import date

from routes.deps import get_db
from services.option_apex_service import OptionApexService
from services.cache import cache, TTL_NSE_DATA

router = APIRouter()


@router.get("/candles/{symbol}")
async def get_candles(
    symbol: str = Path(..., description="Option symbol (e.g., NIFTY24JAN24000CE)"),
    timeframe: str = Query("5m", description="Timeframe: 1m, 5m, 15m, 30m"),
    limit: int = Query(100, description="Number of candles to return"),
    format: str = Query("standard", description="Format: standard or lightweight-charts"),
    db: Session = Depends(get_db)
):
    """
    Get candle data for an option.

    Returns:
    - OHLC candle data
    - Volume per candle
    - OI (Open Interest) per candle
    - IV (Implied Volatility) per candle
    - Institutional flow indicators

    Formats:
    - standard: Raw candle data
    - lightweight-charts: Formatted for TradingView lightweight-charts library
    """
    cache_key = f"option_apex_candles_{symbol}_{timeframe}_{limit}_{format}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        if timeframe not in OptionApexService.TIMEFRAMES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid timeframe. Use one of: {', '.join(OptionApexService.TIMEFRAMES)}"
            )

        service = OptionApexService(db)
        candles = service.get_candles(symbol, timeframe, limit)

        if format == "lightweight-charts":
            result = service.format_for_lightweight_charts(candles)
        else:
            result = {
                "symbol": symbol,
                "timeframe": timeframe,
                "candles": candles,
                "count": len(candles)
            }

        # Cache for 30 seconds
        cache.set(cache_key, result, TTL_NSE_DATA)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching candles: {str(e)}"
        )


@router.get("/signals/active")
async def get_active_signals(
    underlying: Optional[str] = Query(None, description="Filter by underlying (NIFTY, BANKNIFTY)"),
    signal_type: Optional[str] = Query(None, description="Filter by type: ENTRY, EXIT"),
    min_confidence: float = Query(0, description="Minimum confidence score (0-100)"),
    db: Session = Depends(get_db)
):
    """
    Get all active Option Apex signals.

    Signals are generated based on:
    - OI buildup patterns
    - Volume spikes
    - IV changes
    - Institutional flow

    Returns signals with entry/target/stop levels and confidence scores.
    """
    cache_key = f"option_apex_signals_{underlying}_{signal_type}_{min_confidence}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        service = OptionApexService(db)
        signals = service.get_active_signals(underlying)

        # Filter by signal type if specified
        if signal_type:
            signal_type = signal_type.upper()
            if signal_type not in ["ENTRY", "EXIT", "HOLD"]:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid signal_type. Use ENTRY, EXIT, or HOLD"
                )
            signals = [s for s in signals if s["signal_type"] == signal_type]

        # Filter by minimum confidence
        if min_confidence > 0:
            signals = [s for s in signals if s.get("confidence_score", 0) >= min_confidence]

        result = {
            "signals": signals,
            "count": len(signals),
            "filters": {
                "underlying": underlying,
                "signal_type": signal_type,
                "min_confidence": min_confidence
            }
        }

        # Cache for 30 seconds
        cache.set(cache_key, result, TTL_NSE_DATA)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching signals: {str(e)}"
        )


@router.get("/flow/{symbol}")
async def get_institutional_flow(
    symbol: str = Path(..., description="Option symbol"),
    timeframe: str = Query("5m", description="Timeframe for analysis"),
    lookback: int = Query(10, description="Number of candles to analyze"),
    db: Session = Depends(get_db)
):
    """
    Get institutional flow analysis for an option.

    Detects:
    - Bullish accumulation (OI buildup + buying pressure)
    - Bearish accumulation (OI buildup + selling pressure)
    - OI unwinding (position closing)

    Returns flow pattern with strength indicator (0-100).
    """
    cache_key = f"option_apex_flow_{symbol}_{timeframe}_{lookback}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        if timeframe not in OptionApexService.TIMEFRAMES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid timeframe. Use one of: {', '.join(OptionApexService.TIMEFRAMES)}"
            )

        service = OptionApexService(db)
        flow_analysis = service.detect_institutional_flow(symbol, timeframe, lookback)

        result = {
            "symbol": symbol,
            "timeframe": timeframe,
            "flow_analysis": flow_analysis
        }

        # Cache for 30 seconds
        cache.set(cache_key, result, TTL_NSE_DATA)
        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing flow: {str(e)}"
        )


@router.get("/iv-history/{symbol}")
async def get_iv_history(
    symbol: str = Path(..., description="Option symbol"),
    days: int = Query(7, description="Number of days of history"),
    db: Session = Depends(get_db)
):
    """
    Get Implied Volatility history for an option.

    Tracks IV changes to identify:
    - IV expansion (volatility increasing)
    - IV contraction (volatility decreasing)
    - IV percentile (where current IV sits historically)

    Useful for:
    - Timing option entries (buy low IV, sell high IV)
    - Identifying volatility breakouts
    - Risk assessment
    """
    cache_key = f"option_apex_iv_history_{symbol}_{days}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    try:
        service = OptionApexService(db)
        iv_history = service.get_iv_history(symbol, days)

        result = {
            "symbol": symbol,
            "days": days,
            "iv_history": iv_history,
            "count": len(iv_history)
        }

        # Cache for 60 seconds (IV changes slowly)
        cache.set(cache_key, result, 60)
        return result

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error fetching IV history: {str(e)}"
        )


@router.post("/admin/analyze")
async def admin_analyze_option(
    symbol: str = Query(..., description="Option symbol"),
    underlying: str = Query(..., description="Underlying (NIFTY, BANKNIFTY)"),
    strike: float = Query(..., description="Strike price"),
    option_type: str = Query(..., description="CE or PE"),
    expiry_date: str = Query(..., description="Expiry date (YYYY-MM-DD)"),
    timeframe: str = Query("5m", description="Timeframe for analysis"),
    db: Session = Depends(get_db)
):
    """
    Admin endpoint to analyze an option and generate signal.

    Analyzes:
    - Recent candle patterns
    - OI buildups/unwinding
    - Volume activity
    - IV changes
    - Institutional flow

    Returns generated signal if conditions are met.
    """
    try:
        if option_type.upper() not in ["CE", "PE"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid option_type. Use CE or PE"
            )

        expiry = date.fromisoformat(expiry_date)

        service = OptionApexService(db)

        # Generate signal
        signal = await service.generate_signal(
            symbol=symbol,
            underlying=underlying.upper(),
            strike=strike,
            option_type=option_type.upper(),
            expiry_date=expiry,
            timeframe=timeframe
        )

        if not signal:
            return {
                "status": "no_signal",
                "message": "No actionable signal generated",
                "symbol": symbol
            }

        # Store signal
        signal_id = await service.store_signal(signal)

        return {
            "status": "success",
            "message": "Signal generated and stored",
            "signal_id": signal_id,
            "signal": signal
        }

    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error analyzing option: {str(e)}"
        )


@router.get("/timeframes")
async def get_supported_timeframes():
    """
    Get list of supported timeframes for candle analysis.

    Returns available timeframes with descriptions.
    """
    return {
        "timeframes": [
            {"value": "1m", "label": "1 Minute", "description": "Ultra short-term scalping"},
            {"value": "5m", "label": "5 Minutes", "description": "Short-term intraday"},
            {"value": "15m", "label": "15 Minutes", "description": "Medium-term intraday"},
            {"value": "30m", "label": "30 Minutes", "description": "Longer intraday positions"}
        ],
        "default": "5m",
        "note": "Smaller timeframes provide more granular analysis but more noise"
    }
