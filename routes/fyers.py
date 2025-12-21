from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import FyersToken, User
from routes.deps import get_current_user
from services.fyers_service import (
    get_fyers_auth_url,
    generate_fyers_access_token,
    fetch_fyers_holdings,
    fetch_fyers_positions,
    place_fyers_order
)
from datetime import datetime, timedelta

router = APIRouter(prefix="/fyers", tags=["Fyers Broker"])

@router.get("/auth-url")
async def get_auth_url(current_user: User = Depends(get_current_user)):
    """
    Get the Fyers authorization URL
    """
    url = get_fyers_auth_url()
    if not url:
        raise HTTPException(status_code=500, detail="Fyers API not configured on server")
    return {"url": url}

@router.get("/status")
async def get_fyers_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check if Fyers is connected
    """
    token = db.query(FyersToken).filter(FyersToken.user_id == current_user.id).first()
    return {
        "connected": token is not None,
        "connected_at": token.created_at if token else None,
        "expires_at": token.expires_at if token else None
    }

@router.get("/callback")
async def fyers_callback(
    s: str = Query(...),  # status (ok/error)
    code: str = Query(None), # auth code
    id: str = Query(None),   # fyers_id
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Handle Fyers OAuth callback
    """
    if s != "ok" or not code:
        raise HTTPException(status_code=400, detail="Fyers login failed")
    
    token_data = generate_fyers_access_token(code)
    if not token_data or token_data.get("s") != "ok":
        raise HTTPException(status_code=400, detail=f"Failed to generate access token: {token_data.get('message') if token_data else 'Unknown error'}")

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    
    # Store or update token
    token = db.query(FyersToken).filter(FyersToken.user_id == current_user.id).first()
    if token:
        token.access_token = access_token
        token.refresh_token = refresh_token
        token.fyers_id = id
        token.created_at = datetime.utcnow()
        token.expires_at = datetime.utcnow() + timedelta(days=1) # Fyers token usually valid for 24h
    else:
        token = FyersToken(
            user_id=current_user.id,
            access_token=access_token,
            refresh_token=refresh_token,
            fyers_id=id,
            expires_at=datetime.utcnow() + timedelta(days=1)
        )
        db.add(token)
    
    db.commit()
    return {"message": "Fyers connected successfully!"}

@router.get("/holdings")
async def get_holdings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch holdings from Fyers
    """
    token = db.query(FyersToken).filter(FyersToken.user_id == current_user.id).first()
    if not token:
        raise HTTPException(status_code=400, detail="Fyers not connected")
    
    holdings = fetch_fyers_holdings(token.access_token)
    return {"holdings": holdings}

@router.get("/positions")
async def get_positions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Fetch positions from Fyers
    """
    token = db.query(FyersToken).filter(FyersToken.user_id == current_user.id).first()
    if not token:
        raise HTTPException(status_code=400, detail="Fyers not connected")
    
    positions = fetch_fyers_positions(token.access_token)
    return {"positions": positions}

@router.post("/order")
async def place_order(
    order_data: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Place an order on Fyers
    """
    token = db.query(FyersToken).filter(FyersToken.user_id == current_user.id).first()
    if not token:
        raise HTTPException(status_code=400, detail="Fyers not connected")
    
    response = place_fyers_order(token.access_token, order_data)
    return response

@router.delete("/disconnect")
async def disconnect_fyers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disconnect Fyers account
    """
    db.query(FyersToken).filter(FyersToken.user_id == current_user.id).delete()
    db.commit()
    return {"message": "Fyers disconnected successfully"}
