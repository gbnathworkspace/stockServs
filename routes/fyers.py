from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
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
async def get_auth_url(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Get the Fyers authorization URL. 
    We pass the current token in the state to verify the user on callback.
    """
    auth_header = request.headers.get("Authorization")
    token = None
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
    
    # Store token in response for callback verification
    url = get_fyers_auth_url(state=token)
    if not url:
        raise HTTPException(status_code=500, detail="Fyers API not configured on server")
    
    # Return URL and token - frontend will store token before redirect
    return {"url": url, "token": token}

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
    request: Request,
    s: str = Query(...),  # status (ok/error)
    code: str = Query(None), # auth code (standard)
    auth_code: str = Query(None), # auth code (sometimes sent as auth_code)
    id: str = Query(None),   # fyers_id
    state: str = Query(None), # access token we passed (may not be returned by Fyers)
    db: Session = Depends(get_db)
):
    """
    Handle Fyers OAuth callback.
    Fyers may not return state param, so we try multiple auth methods.
    """
    from routes.deps import SECRET_KEY, ALGORITHM
    from jose import JWTError, jwt
    
    print(f"Fyers Callback received: s={s}, code={code}, auth_code={auth_code is not None}, state={state is not None}")
    
    # Try to get user from state parameter first
    current_user = None
    fyers_auth_code = None
    
    if state:
        try:
            payload = jwt.decode(state, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = int(payload.get("sub"))
            current_user = db.query(User).filter(User.id == user_id).first()
            print(f"User from state: {current_user.email if current_user else 'None'}")
        except Exception as e:
            print(f"State decode failed: {e}")
    
    # If state didn't work, check if auth_code looks like a JWT (it might be our state)
    if not current_user and auth_code and auth_code.startswith('eyJ'):
        try:
            payload = jwt.decode(auth_code, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = int(payload.get("sub"))
            current_user = db.query(User).filter(User.id == user_id).first()
            print(f"User from auth_code JWT: {current_user.email if current_user else 'None'}")
            # auth_code was actually our state, so the real auth code might be in 'code'
            # Don't use auth_code as the Fyers auth code
        except Exception as e:
            print(f"auth_code is not our JWT, treating as Fyers auth code: {e}")
            fyers_auth_code = auth_code
    else:
        fyers_auth_code = auth_code
    
    if not current_user:
        print("No user found from state or auth_code")
        return RedirectResponse(url="/app/?fyers_error=auth_failed")

    # Determine the actual Fyers auth code
    # Note: code=200 is a status code from Fyers, not an auth code
    actual_code = fyers_auth_code if fyers_auth_code else (code if code and code != '200' else None)
    
    print(f"Fyers Callback Final: status={s}, user={current_user.email}, actual_code={'present' if actual_code else 'missing'}")
    
    if s != "ok":
        return RedirectResponse(url="/app/?fyers_error=status_not_ok")
        
    if not actual_code:
        # No auth code found - check all params for debugging
        all_params = dict(request.query_params)
        print(f"All callback params: {all_params}")
        return RedirectResponse(url="/app/?fyers_error=missing_auth_code")
    
    token_data = generate_fyers_access_token(actual_code)
    if not token_data or token_data.get("s") != "ok":
        error_msg = token_data.get('message') if token_data else 'Unknown error'
        print(f"Fyers Token Error: {error_msg}")
        return RedirectResponse(url=f"/app/?fyers_error={error_msg}")

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    
    # Store or update token
    token = db.query(FyersToken).filter(FyersToken.user_id == current_user.id).first()
    if token:
        token.access_token = access_token
        token.refresh_token = refresh_token
        token.fyers_id = id
        token.created_at = datetime.utcnow()
        token.expires_at = datetime.utcnow() + timedelta(days=1)
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
    # Redirect back to settings page in the frontend
    return RedirectResponse(url="/app/?fyers_connected=true")

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
