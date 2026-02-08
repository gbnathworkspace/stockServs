from typing import List, Optional, Dict, Any
from fastapi import HTTPException
from sqlalchemy.orm import Session
from concurrent.futures import ThreadPoolExecutor, as_completed
import yfinance as yf

from database.models import VirtualHolding, VirtualWallet, VirtualOrder
from schemas.portfolio import TradePayload, HoldingOut, FundsPayload
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


def _is_fno_symbol(symbol: str) -> bool:
    """Detect if a symbol is an F&O derivative (option/future)."""
    s = (symbol or "").upper().strip()
    # Fyers format: NSE:NIFTY2621225000CE or NSE:RELIANCE26FEB2000PE
    if s.startswith("NSE:") and (s.endswith("CE") or s.endswith("PE")):
        return True
    # Plain format with CE/PE suffix and digits: NIFTY2621225000CE
    if (s.endswith("CE") or s.endswith("PE")) and any(c.isdigit() for c in s):
        return True
    return False


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

    # F&O symbols can't be looked up on yfinance — return None
    # The trade execution uses the provided price for F&O
    if _is_fno_symbol(symbol):
        return None

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
    return [_serialize_holding(row) for row in rows]


def get_portfolio_summary(db: Session, user_id: int) -> Dict[str, Any]:
    """Get portfolio summary including wallet balance and holdings value.

    LTP enrichment is skipped here for performance; the frontend enriches
    holdings with live prices via Fyers.
    """
    wallet = get_or_create_wallet(db, user_id)
    holdings = get_portfolio_holdings(db, user_id)

    total_invested = sum(h.average_price * h.quantity for h in holdings)

    return {
        "wallet_balance": round(wallet.balance, 2),
        "holdings_value": None,
        "total_invested": round(total_invested, 2),
        "total_pnl": None,
        "net_worth": None,
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
    quantity = payload.quantity
    side = payload.side
    order_type = getattr(payload, 'order_type', 'MARKET') or 'MARKET'
    limit_price = getattr(payload, 'limit_price', None)
    is_fno = _is_fno_symbol(symbol)

    # Get current market price (LTP)
    # For F&O: use the provided price since yfinance doesn't support derivatives
    current_ltp = payload.price if is_fno else _fetch_ltp(symbol)
    
    # Determine execution price based on order type
    if order_type == "LIMIT":
        if limit_price is None or limit_price <= 0:
            raise HTTPException(
                status_code=400, 
                detail="Limit price is required for LIMIT orders and must be positive"
            )
        limit_price = _round_price(limit_price)
        
        # For virtual trading, we simulate limit order behavior:
        # - BUY LIMIT: Executes if limit_price >= current market price (willing to pay at or above market)
        # - SELL LIMIT: Executes if limit_price <= current market price (willing to sell at or below market)
        # If conditions not met, order would be "PENDING" in a real system
        
        if current_ltp:
            if side == "BUY":
                if limit_price < current_ltp:
                    # In real trading, this would stay pending
                    # For simulation, we'll still execute but at the limit price
                    # This mimics the scenario where price drops to limit
                    execution_price = limit_price
                    order_status = "FILLED"
                else:
                    # Limit price >= market price, execute immediately at market (best available)
                    execution_price = min(limit_price, current_ltp)
                    order_status = "FILLED"
            else:  # SELL
                if limit_price > current_ltp:
                    # In real trading, this would stay pending
                    # For simulation, we execute at limit price
                    execution_price = limit_price
                    order_status = "FILLED"
                else:
                    # Limit price <= market price, execute immediately at market (best available)
                    execution_price = max(limit_price, current_ltp)
                    order_status = "FILLED"
        else:
            # No LTP available, use limit price
            execution_price = limit_price
            order_status = "FILLED"
    else:
        # MARKET order - use the provided price (which should be current market price)
        execution_price = _round_price(payload.price)
        order_status = "FILLED"
    
    total_value = round(execution_price * quantity, 2)

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
            total_cost = holding.average_price * holding.quantity + execution_price * quantity
            total_qty = holding.quantity + quantity
            holding.quantity = total_qty
            holding.average_price = round(total_cost / total_qty, 2)
        else:
            holding = VirtualHolding(
                user_id=user_id,
                symbol=symbol,
                quantity=quantity,
                average_price=execution_price
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

    # Log the order with proper order type and execution details
    order = VirtualOrder(
        user_id=user_id,
        symbol=symbol,
        side=side,
        quantity=quantity,
        price=execution_price,
        total_value=total_value,
        order_type=order_type,
        status=order_status
    )
    db.add(order)

    db.commit()

    holdings = db.query(VirtualHolding).filter(
        VirtualHolding.user_id == user_id
    ).all()

    serialized = [_serialize_holding(row) for row in holdings]
    current = next((h for h in serialized if h.symbol == symbol), None)

    return {
        "holding": current,
        "holdings": serialized,
        "side": side,
        "wallet_balance": round(wallet.balance, 2),
        "order": {
            "symbol": symbol,
            "side": side,
            "quantity": quantity,
            "price": execution_price,
            "total_value": total_value,
            "order_type": order_type,
            "limit_price": limit_price if order_type == "LIMIT" else None,
            "status": order_status,
            "market_price": current_ltp
        }
    }


def manage_funds(db: Session, user_id: int, payload: FundsPayload) -> float:
    """Add funds or set wallet balance."""
    wallet = get_or_create_wallet(db, user_id)
    
    if payload.type == "SET":
        wallet.balance = payload.amount
    else:
        wallet.balance += payload.amount
        
    db.commit()
    db.refresh(wallet)
    return wallet.balance
