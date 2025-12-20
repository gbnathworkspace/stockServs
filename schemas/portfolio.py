from typing import Optional, List
from pydantic import BaseModel, Field, validator


class TradePayload(BaseModel):
    symbol: str
    quantity: int = Field(..., gt=0)
    price: float = Field(..., gt=0)
    side: str = Field("BUY")

    @validator("side")
    def normalize_side(cls, value: str) -> str:
        side = (value or "BUY").upper()
        if side not in {"BUY", "SELL"}:
            raise ValueError("side must be BUY or SELL")
        return side


class HoldingOut(BaseModel):
    symbol: str
    quantity: int
    average_price: float
    user_id: int
    ltp: Optional[float] = None
    pnl: Optional[float] = None

    class Config:
        orm_mode = True


class PortfolioResponse(BaseModel):
    holdings: List[HoldingOut]


class TradeResponse(BaseModel):
    holding: Optional[HoldingOut] = None
    holdings: List[HoldingOut]
    side: str
