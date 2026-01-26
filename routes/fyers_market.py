"""
Fyers Market Data Routes
Provides market data exclusively from Fyers API for the Market Sandbox tab.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timedelta

from database.connection import get_db
from database.models import FyersToken, User
from routes.deps import get_current_user
from services.fyers_service import (
    get_fyers_client,
    get_fyers_cm_symbols,
    convert_nse_to_fyers,
    convert_fyers_to_nse,
    fetch_quotes_batch,
    fetch_index_quotes,
    fetch_historical_data,
    download_fyers_cm_master,
    SYM_MASTER_CM,
    MAJOR_INDICES,
)
from services.option_clock_service import option_clock_service
import os

router = APIRouter(prefix="/fyers/market", tags=["Fyers Market Data"])


def _get_user_or_system_token(current_user: User, db: Session) -> Optional[str]:
    """
    Get user's Fyers token or fall back to system token.
    Returns None if no valid token is available.
    """
    # 1. Try user's token first
    user_token = db.query(FyersToken).filter(
        FyersToken.user_id == current_user.id
    ).first()

    if user_token and user_token.access_token:
        # Check expiry if set
        if user_token.expires_at and user_token.expires_at > datetime.now():
            return user_token.access_token
        elif not user_token.expires_at:
            return user_token.access_token

    # 2. Fall back to system token (any valid token in DB)
    system_token = option_clock_service.get_system_access_token()
    return system_token


@router.get("/status")
async def get_fyers_market_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check if Fyers is connected and can fetch market data.
    Returns connection status for both user-specific and system-wide tokens.
    """
    user_token = db.query(FyersToken).filter(
        FyersToken.user_id == current_user.id
    ).first()

    system_token = option_clock_service.get_system_access_token()

    user_connected = user_token is not None and user_token.access_token is not None
    system_available = system_token is not None

    return {
        "connected": user_connected or system_available,
        "user_connected": user_connected,
        "system_available": system_available,
        "expires_at": user_token.expires_at.isoformat() if user_token and user_token.expires_at else None,
        "message": None if (user_connected or system_available) else "Connect Fyers to view live market data"
    }


@router.get("/all-stocks")
async def get_all_stocks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all NSE equity stocks with live prices from Fyers.
    Returns stocks without prices if Fyers is not connected.
    """
    # 1. Get symbol list from CM master (cached)
    symbols = get_fyers_cm_symbols()
    if not symbols:
        await download_fyers_cm_master()
        symbols = get_fyers_cm_symbols()

    if not symbols:
        return {
            "stocks": [],
            "source": "fyers",
            "fyers_connected": False,
            "error": "Failed to load symbol master"
        }

    # 2. Try to get live prices
    token = _get_user_or_system_token(current_user, db)

    stocks = []
    fyers_connected = token is not None

    if token:
        # Batch fetch quotes (50 at a time)
        # For performance, we'll fetch prices for a subset of popular stocks
        # Full list would be too many API calls
        fyers_symbols = [s["fyers_symbol"] for s in symbols[:100]]  # Top 100 stocks

        try:
            # Fetch in batches of 50
            price_data = {}
            for i in range(0, len(fyers_symbols), 50):
                batch = fyers_symbols[i:i + 50]
                batch_prices = fetch_quotes_batch(token, batch)
                price_data.update(batch_prices)

            # Build response with prices
            for s in symbols:
                nse_symbol = s["symbol"]
                quote = price_data.get(nse_symbol, {})
                stocks.append({
                    "symbol": nse_symbol,
                    "identifier": s.get("identifier", nse_symbol),
                    "lastPrice": quote.get("lastPrice", 0),
                    "pChange": quote.get("pChange", 0),
                    "change": quote.get("change", 0),
                    "open": quote.get("open", 0),
                    "high": quote.get("high", 0),
                    "low": quote.get("low", 0),
                    "previousClose": quote.get("previousClose", 0),
                    "volume": quote.get("volume", 0),
                    "fyers_symbol": s["fyers_symbol"],
                })
        except Exception as e:
            print(f"[FYERS_MARKET] Error fetching quotes: {e}")
            fyers_connected = False
            # Return symbols without prices on error
            for s in symbols:
                stocks.append({
                    "symbol": s["symbol"],
                    "identifier": s.get("identifier", s["symbol"]),
                    "lastPrice": 0,
                    "pChange": 0,
                    "fyers_symbol": s["fyers_symbol"],
                })
    else:
        # Return symbol list without prices
        for s in symbols:
            stocks.append({
                "symbol": s["symbol"],
                "identifier": s.get("identifier", s["symbol"]),
                "lastPrice": 0,
                "pChange": 0,
                "fyers_symbol": s["fyers_symbol"],
            })

    return {
        "stocks": stocks,
        "source": "fyers",
        "fyers_connected": fyers_connected,
        "total": len(stocks)
    }


@router.get("/major-indices")
async def get_major_indices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get major index quotes (NIFTY, BANKNIFTY, FINNIFTY, etc.) from Fyers.
    """
    token = _get_user_or_system_token(current_user, db)

    if not token:
        return {
            "indices": [],
            "fyers_connected": False,
            "message": "Connect Fyers to view live indices"
        }

    indices = fetch_index_quotes(token)

    return {
        "indices": indices,
        "fyers_connected": True,
        "source": "fyers"
    }


@router.get("/quotes")
async def get_quotes(
    symbols: str = Query(..., description="Comma-separated NSE symbols (max 50)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get real-time quotes for specific symbols.
    Used for watchlist price refresh.
    """
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]

    if len(symbol_list) > 50:
        raise HTTPException(400, "Maximum 50 symbols per request")

    if not symbol_list:
        return {"quotes": {}, "fyers_connected": False}

    token = _get_user_or_system_token(current_user, db)

    if not token:
        return {
            "quotes": {},
            "fyers_connected": False,
            "message": "Connect Fyers to view live quotes"
        }

    # Convert to Fyers format and fetch
    fyers_symbols = [convert_nse_to_fyers(s) for s in symbol_list]
    quotes = fetch_quotes_batch(token, fyers_symbols)

    return {
        "quotes": quotes,
        "fyers_connected": True,
        "source": "fyers"
    }


@router.get("/candles")
async def get_candles(
    symbol: str = Query(..., description="NSE symbol (e.g., RELIANCE)"),
    interval: str = Query("5", description="Candle interval: 1, 5, 15, 30, 60 (min) or D (day)"),
    period: str = Query("5d", description="Data period: 1d, 5d, 10d, 1mo, 3mo, 6mo, 1y"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get historical OHLCV data from Fyers for chart display.
    """
    token = _get_user_or_system_token(current_user, db)

    if not token:
        return {
            "candles": [],
            "volume": [],
            "fyers_connected": False,
            "message": "Connect Fyers to view charts"
        }

    # Map frontend interval format to Fyers resolution
    resolution_map = {
        "1m": "1",
        "5m": "5",
        "15m": "15",
        "30m": "30",
        "1h": "60",
        "60m": "60",
        "1d": "D",
        "D": "D",
        # Also accept raw values
        "1": "1",
        "5": "5",
        "15": "15",
        "30": "30",
        "60": "60",
    }
    resolution = resolution_map.get(interval, interval)

    # Calculate date range based on period
    today = datetime.now()
    period_map = {
        "1d": 1,
        "5d": 5,
        "10d": 10,
        "1mo": 30,
        "3mo": 90,
        "6mo": 180,
        "1y": 365,
        "2y": 730,
    }
    days = period_map.get(period, 5)
    range_from = (today - timedelta(days=days)).strftime("%Y-%m-%d")
    range_to = today.strftime("%Y-%m-%d")

    # Convert symbol to Fyers format
    fyers_symbol = convert_nse_to_fyers(symbol.upper().strip())

    data = fetch_historical_data(
        access_token=token,
        symbol=fyers_symbol,
        resolution=resolution,
        range_from=range_from,
        range_to=range_to
    )

    if data.get("error"):
        return {
            "candles": [],
            "volume": [],
            "fyers_connected": True,
            "error": data["error"],
            "symbol": symbol
        }

    # Calculate technical indicators if we have enough data
    candles = data.get("candles", [])
    indicators = {}

    if len(candles) >= 20:
        closes = [c["close"] for c in candles]

        # SMA 20
        sma20 = []
        for i in range(len(closes)):
            if i >= 19:
                avg = sum(closes[i - 19:i + 1]) / 20
                sma20.append({"time": candles[i]["time"], "value": round(avg, 2)})
        indicators["sma20"] = sma20

        # EMA 20
        ema20 = []
        multiplier = 2 / (20 + 1)
        ema_val = sum(closes[:20]) / 20  # Start with SMA
        for i in range(20, len(closes)):
            ema_val = (closes[i] - ema_val) * multiplier + ema_val
            ema20.append({"time": candles[i]["time"], "value": round(ema_val, 2)})
        indicators["ema20"] = ema20

        # RSI 14
        if len(candles) >= 14:
            rsi = []
            gains = []
            losses = []
            for i in range(1, len(closes)):
                change = closes[i] - closes[i - 1]
                gains.append(max(0, change))
                losses.append(max(0, -change))

            for i in range(13, len(closes) - 1):
                avg_gain = sum(gains[i - 13:i + 1]) / 14
                avg_loss = sum(losses[i - 13:i + 1]) / 14
                if avg_loss == 0:
                    rs = 100
                else:
                    rs = avg_gain / avg_loss
                rsi_val = 100 - (100 / (1 + rs))
                rsi.append({"time": candles[i + 1]["time"], "value": round(rsi_val, 2)})
            indicators["rsi"] = rsi

    return {
        "candles": candles,
        "volume": data.get("volume", []),
        "indicators": indicators,
        "symbol": symbol,
        "interval": interval,
        "period": period,
        "fyers_connected": True,
        "source": "fyers"
    }


@router.get("/option-chain/{symbol}")
async def get_option_chain_fyers(
    symbol: str,
    expiry: str = Query(None, description="Expiry date in YYYY-MM-DD format"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get option chain data using Fyers quotes API.
    Uses the existing option_clock_service for option chain fetching.
    """
    token = _get_user_or_system_token(current_user, db)

    if not token:
        return {
            "data": None,
            "fyers_connected": False,
            "message": "Connect Fyers to view option chain"
        }

    # Use option_clock_service to fetch option chain
    # It already has the logic for generating option symbols and fetching quotes
    data = option_clock_service.fetch_option_chain(token, symbol.upper())

    if not data:
        return {
            "data": None,
            "fyers_connected": True,
            "error": f"Failed to fetch option chain for {symbol}"
        }

    # Format for frontend
    return {
        "symbol": symbol.upper(),
        "spotPrice": data.get("spot_price", 0),
        "expiryDate": data.get("expiry").isoformat() if data.get("expiry") else None,
        "timestamp": data.get("timestamp").isoformat() if data.get("timestamp") else None,
        "totalCallOI": data.get("total_call_oi", 0),
        "totalPutOI": data.get("total_put_oi", 0),
        "pcr": data.get("pcr", 0),
        "maxPainStrike": data.get("max_pain_strike", 0),
        "highestCallOIStrike": data.get("highest_call_oi_strike", 0),
        "highestPutOIStrike": data.get("highest_put_oi_strike", 0),
        "strikeData": data.get("strike_breakdown", {}),
        "fyers_connected": True,
        "source": "fyers"
    }


@router.post("/refresh-master")
async def refresh_symbol_master(
    current_user: User = Depends(get_current_user)
):
    """
    Force refresh of the Fyers symbol master CSV files.
    """
    from services.fyers_service import download_fyers_master

    results = {
        "cm_master": False,
        "fo_master": False
    }

    # Refresh Cash Market master
    try:
        results["cm_master"] = await download_fyers_cm_master()
    except Exception as e:
        print(f"[FYERS_MARKET] CM master refresh error: {e}")

    # Refresh F&O master
    try:
        results["fo_master"] = await download_fyers_master()
    except Exception as e:
        print(f"[FYERS_MARKET] FO master refresh error: {e}")

    return {
        "success": results["cm_master"] or results["fo_master"],
        "results": results
    }
