from typing import List, Optional, Dict, Any
from fastapi import HTTPException
from sqlalchemy.orm import Session
import yfinance as yf

from database.models import VirtualHolding
from schemas.portfolio import TradePayload, HoldingOut


def _sanitize_symbol(symbol: str) -> str:
    cleaned = (symbol or "").strip().upper()
    if not cleaned:
        raise HTTPException(status_code=400, detail="Symbol is required")
    return cleaned


def _round_price(price: float) -> float:
    try:
        value = round(float(price), 2)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid price")
    if value <= 0:
        raise HTTPException(status_code=400, detail="Quantity and price must be positive")
    return value


def _serialize_holding(row: VirtualHolding, ltp: Optional[float] = None) -> HoldingOut:
    pnl = None
    if ltp is not None:
        pnl = (ltp - row.average_price) * row.quantity
    return HoldingOut(
        symbol=row.symbol,
        quantity=row.quantity,
        average_price=row.average_price,
        user_id=row.user_id,
        ltp=ltp,
        pnl=pnl,
    )


def _fetch_ltp(symbol: str) -> Optional[float]:
    ticker = yf.Ticker(f"{symbol}.NS")
    try:
        fast = getattr(ticker, "fast_info", None) or {}
        price = fast.get("last_price") or fast.get("last_close")
        if price:
            return float(price)
        hist = ticker.history(period="1d")
        if not hist.empty and "Close" in hist.columns:
            return float(hist["Close"].iloc[-1])
    except Exception:
        return None
    return None


def _enrich_holdings(rows: List[VirtualHolding]) -> List[HoldingOut]:
    enriched: List[HoldingOut] = []
    for row in rows:
        ltp = _fetch_ltp(row.symbol)
        enriched.append(_serialize_holding(row, ltp))
    return enriched


def get_portfolio_holdings(db: Session, user_id: int) -> List[HoldingOut]:
    rows = db.query(VirtualHolding).filter(VirtualHolding.user_id == user_id).all()
    return _enrich_holdings(rows)


def execute_trade(db: Session, user_id: int, payload: TradePayload) -> Dict[str, Any]:
    symbol = _sanitize_symbol(payload.symbol)
    price = _round_price(payload.price)
    quantity = payload.quantity
    side = payload.side

    holding = db.query(VirtualHolding).filter(
        VirtualHolding.user_id == user_id,
        VirtualHolding.symbol == symbol
    ).first()

    if side == "BUY":
        if holding:
            total_cost = holding.average_price * holding.quantity + price * quantity
            total_qty = holding.quantity + quantity
            holding.quantity = total_qty
            holding.average_price = round(total_cost / total_qty, 2)
        else:
            holding = VirtualHolding(
                user_id=user_id,
                symbol=symbol,
                quantity=quantity,
                average_price=price
            )
            db.add(holding)
    elif side == "SELL":
        if not holding or holding.quantity < quantity:
            raise HTTPException(status_code=400, detail="Not enough quantity to sell")
        holding.quantity -= quantity
        if holding.quantity == 0:
            db.delete(holding)
    else:
        raise HTTPException(status_code=400, detail="Invalid side")

    db.commit()

    holdings = db.query(VirtualHolding).filter(
        VirtualHolding.user_id == user_id
    ).all()

    enriched = _enrich_holdings(holdings)
    current = next((h for h in enriched if h.symbol == symbol), None)

    return {
        "holding": current,
        "holdings": enriched,
        "side": side
    }
