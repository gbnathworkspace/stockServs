from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from database.connection import get_db
from routes.deps import get_current_user
from schemas.portfolio import TradePayload, PortfolioResponse, TradeResponse
from services.portfolio_service import (
    get_portfolio_holdings,
    execute_trade,
    get_portfolio_summary,
    get_wallet_balance,
    get_order_history
)

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


@router.get("", response_model=PortfolioResponse)
async def get_portfolio(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    holdings = get_portfolio_holdings(db, current_user.id)
    return PortfolioResponse(holdings=holdings)


@router.get("/summary")
async def get_summary(current_user=Depends(get_current_user), db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Get portfolio summary including wallet balance, holdings value, and P&L."""
    return get_portfolio_summary(db, current_user.id)


@router.get("/wallet")
async def get_wallet(current_user=Depends(get_current_user), db: Session = Depends(get_db)) -> Dict[str, float]:
    """Get user's virtual wallet balance."""
    balance = get_wallet_balance(db, current_user.id)
    return {"balance": balance}


@router.get("/orders")
async def get_orders(
    limit: int = 50,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Dict[str, Any]:
    """Get user's order history."""
    orders = get_order_history(db, current_user.id, limit)
    return {"orders": orders, "count": len(orders)}


@router.post("/trade", response_model=TradeResponse)
async def place_trade(payload: TradePayload, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    result = execute_trade(db, current_user.id, payload)
    return TradeResponse(**result)
