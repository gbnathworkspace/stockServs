from services.zerodha_service import fetch_holdings
from fastapi import APIRouter, Depends, HTTPException
from database.models import ZerodhaToken
from sqlalchemy.orm import Session
from database.connection import get_db




router = APIRouter(prefix="/holdings", tags=["Holdings"])

@router.get("/{zerodha_user_id}")
async def get_holdings(zerodha_user_id: str, db: Session = Depends(get_db)):
    """Fetch holdings for a given Zerodha user ID"""
    zerodha_token = db.query(ZerodhaToken).filter(
        ZerodhaToken.zerodha_user_id == zerodha_user_id
    ).first()

    if not zerodha_token:
        raise HTTPException(status_code=404, detail="User not found")

    holdings = fetch_holdings(zerodha_token.access_token)
    if holdings is None:
        raise HTTPException(status_code=400, detail="Failed to fetch holdings from Zerodha")

    return {"holdings": holdings}


