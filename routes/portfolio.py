from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database.connection import get_db
from routes.deps import get_current_user
from schemas.portfolio import TradePayload, PortfolioResponse, TradeResponse
from services.portfolio_service import get_portfolio_holdings, execute_trade

router = APIRouter(prefix="/portfolio", tags=["Portfolio"])


@router.get("", response_model=PortfolioResponse)
async def get_portfolio(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    holdings = get_portfolio_holdings(db, current_user.id)
    return PortfolioResponse(holdings=holdings)


@router.post("/trade", response_model=TradeResponse)
async def place_trade(payload: TradePayload, current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    result = execute_trade(db, current_user.id, payload)
    return TradeResponse(**result)
