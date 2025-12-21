from typing import List, Optional, Dict, Any
from fastapi import HTTPException
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor, as_completed
import yfinance as yf

from database.models import VirtualHolding, VirtualWallet, VirtualOrder
from schemas.portfolio import TradePayload, HoldingOut
from services.cache import cache, stock_price_key, TTL_STOCK_PRICE


# Starting balance for new users
INITIAL_BALANCE = 100000.00  # ₹1,00,000


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
        pnl = round((ltp - row.average_price) * row.quantity, 2)
    return HoldingOut(
        symbol=row.symbol,
        quantity=row.quantity,
        average_price=row.average_price,
        user_id=row.user_id,
        ltp=ltp,
        pnl=pnl,
    )


def _fetch_ltp(symbol: str) -> Optional[float]:
    """Fetch last traded price with caching."""
    # Check cache first
    cache_key = stock_price_key(symbol)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    # Fetch from yfinance
    ticker = yf.Ticker(f"{symbol}.NS")
    try:
        fast = getattr(ticker, "fast_info", None) or {}
        price = fast.get("last_price") or fast.get("last_close")
        if price:
            result = float(price)
            cache.set(cache_key, result, TTL_STOCK_PRICE)
            return result
        hist = ticker.history(period="1d")
        if not hist.empty and "Close" in hist.columns:
            result = float(hist["Close"].iloc[-1])
            cache.set(cache_key, result, TTL_STOCK_PRICE)
            return result
    except Exception:
        return None
    return None


def _fetch_ltp_batch(symbols: List[str]) -> Dict[str, Optional[float]]:
    """Fetch LTP for multiple symbols in parallel."""
    results: Dict[str, Optional[float]] = {}

    if not symbols:
        return results

    # Use ThreadPoolExecutor for parallel fetching
    with ThreadPoolExecutor(max_workers=min(10, len(symbols))) as executor:
        future_to_symbol = {
            executor.submit(_fetch_ltp, symbol): symbol
            for symbol in symbols
        }
        for future in as_completed(future_to_symbol):
            symbol = future_to_symbol[future]
            try:
                results[symbol] = future.result()
            except Exception:
                results[symbol] = None

    return results


def _enrich_holdings(rows: List[VirtualHolding]) -> List[HoldingOut]:
    """Enrich holdings with LTP - uses parallel fetching for performance."""
    if not rows:
        return []

    # Get all symbols
    symbols = [row.symbol for row in rows]

    # Fetch all LTPs in parallel
    ltp_map = _fetch_ltp_batch(symbols)

    # Build enriched holdings
    enriched: List[HoldingOut] = []
    for row in rows:
        ltp = ltp_map.get(row.symbol)
        enriched.append(_serialize_holding(row, ltp))

    return enriched


def get_or_create_wallet(db: Session, user_id: int) -> VirtualWallet:
    """Get user's wallet or create one with initial balance."""
    wallet = db.query(VirtualWallet).filter(VirtualWallet.user_id == user_id).first()
    if not wallet:
        wallet = VirtualWallet(user_id=user_id, balance=INITIAL_BALANCE)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return wallet


def get_wallet_balance(db: Session, user_id: int) -> float:
    """Get user's wallet balance."""
    wallet = get_or_create_wallet(db, user_id)
    return wallet.balance


def get_portfolio_holdings(db: Session, user_id: int) -> List[HoldingOut]:
    rows = db.query(VirtualHolding).filter(VirtualHolding.user_id == user_id).all()
    return _enrich_holdings(rows)


def get_portfolio_summary(db: Session, user_id: int) -> Dict[str, Any]:
    """Get portfolio summary including wallet balance and holdings value."""
    wallet = get_or_create_wallet(db, user_id)
    holdings = get_portfolio_holdings(db, user_id)

    # Calculate total holdings value and P&L
    total_invested = sum(h.average_price * h.quantity for h in holdings)
    total_current = sum((h.ltp or h.average_price) * h.quantity for h in holdings)
    total_pnl = sum(h.pnl or 0 for h in holdings)

    return {
        "wallet_balance": round(wallet.balance, 2),
        "holdings_value": round(total_current, 2),
        "total_invested": round(total_invested, 2),
        "total_pnl": round(total_pnl, 2),
        "net_worth": round(wallet.balance + total_current, 2),
        "holdings_count": len(holdings),
        "holdings": holdings
    }


def get_order_history(db: Session, user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """Get user's order history."""
    orders = db.query(VirtualOrder).filter(
        VirtualOrder.user_id == user_id
    ).order_by(VirtualOrder.created_at.desc()).limit(limit).all()

    return [
        {
            "id": o.id,
            "symbol": o.symbol,
            "side": o.side,
            "quantity": o.quantity,
            "price": o.price,
            "total_value": o.total_value,
            "order_type": o.order_type,
            "status": o.status,
            "created_at": o.created_at.isoformat()
        }
        for o in orders
    ]


def execute_trade(db: Session, user_id: int, payload: TradePayload) -> Dict[str, Any]:
    symbol = _sanitize_symbol(payload.symbol)
    price = _round_price(payload.price)
    quantity = payload.quantity
    side = payload.side
    total_value = round(price * quantity, 2)

    # Get or create wallet
    wallet = get_or_create_wallet(db, user_id)

    # Check wallet balance for BUY
    if side == "BUY" and wallet.balance < total_value:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient balance. Required: ₹{total_value:,.2f}, Available: ₹{wallet.balance:,.2f}"
        )

    holding = db.query(VirtualHolding).filter(
        VirtualHolding.user_id == user_id,
        VirtualHolding.symbol == symbol
    ).first()

    if side == "BUY":
        # Deduct from wallet
        wallet.balance -= total_value

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

        # Add to wallet
        wallet.balance += total_value

        holding.quantity -= quantity
        if holding.quantity == 0:
            db.delete(holding)
    else:
        raise HTTPException(status_code=400, detail="Invalid side")

    # Log the order
    order = VirtualOrder(
        user_id=user_id,
        symbol=symbol,
        side=side,
        quantity=quantity,
        price=price,
        total_value=total_value,
        order_type="MARKET",
        status="FILLED"
    )
    db.add(order)

    db.commit()

    holdings = db.query(VirtualHolding).filter(
        VirtualHolding.user_id == user_id
    ).all()

    enriched = _enrich_holdings(holdings)
    current = next((h for h in enriched if h.symbol == symbol), None)

    return {
        "holding": current,
        "holdings": enriched,
        "side": side,
        "wallet_balance": round(wallet.balance, 2),
        "order": {
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "price": price,
            "total_value": total_value
        }
    }
