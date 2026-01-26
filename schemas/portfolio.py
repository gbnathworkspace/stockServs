from typing import Optional, List
from pydantic import BaseModel, Field, validator


class TradePayload(BaseModel):
    symbol: str
    quantity: int = Field(..., gt=0)
    price: float = Field(..., gt=0)
    side: str = Field("BUY")
    order_type: str = Field("MARKET")  # MARKET or LIMIT
    limit_price: Optional[float] = None  # Required for LIMIT orders

    @validator("side")
    def normalize_side(cls, value: str) -> str:
        side = (value or "BUY").upper()
        if side not in {"BUY", "SELL"}:
            raise ValueError("side must be BUY or SELL")
        return side

    @validator("order_type")
    def normalize_order_type(cls, value: str) -> str:
        order_type = (value or "MARKET").upper()
        if order_type not in {"MARKET", "LIMIT"}:
            raise ValueError("order_type must be MARKET or LIMIT")
        return order_type


class FundsPayload(BaseModel):
    amount: float = Field(..., gt=0)
    type: str = Field("TOPUP")  # TOPUP or SET

    @validator("type")
    def normalize_type(cls, value: str) -> str:
        t = (value or "TOPUP").upper()
        if t not in {"TOPUP", "SET"}:
            raise ValueError("type must be TOPUP or SET")
        return t


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


class OrderInfo(BaseModel):
    symbol: str
    side: str
    quantity: int
    price: float
    total_value: float


class TradeResponse(BaseModel):
    holding: Optional[HoldingOut] = None
    holdings: List[HoldingOut]
    side: str
    wallet_balance: Optional[float] = None
    order: Optional[OrderInfo] = None
