from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import FyersToken, User
from routes.deps import get_current_user
from services.fyers_service import (
    get_fyers_auth_url,
    generate_fyers_access_token,
    refresh_fyers_access_token,
    fetch_fyers_holdings,
    fetch_fyers_positions,
    place_fyers_order,
    download_fyers_master,
    get_fyers_symbols
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
    Check if Fyers is connected with valid, non-expired token.
    Auto-refreshes expired tokens using refresh_token if available.
    """
    token = db.query(FyersToken).filter(FyersToken.user_id == current_user.id).first()

    is_connected = False
    is_expired = False
    was_refreshed = False

    if token and token.access_token:
        if not token.expires_at:
            is_connected = True
        elif token.expires_at > datetime.now():
            is_connected = True
        else:
            # Token expired — try auto-refresh
            is_expired = True
            if token.refresh_token:
                print(f"[FYERS_STATUS] Token expired for user {current_user.id}, attempting refresh...")
                refresh_result = refresh_fyers_access_token(token.refresh_token)
                if refresh_result and refresh_result.get("s") == "ok":
                    new_access = refresh_result.get("access_token")
                    new_refresh = refresh_result.get("refresh_token")
                    if new_access:
                        token.access_token = new_access
                        if new_refresh:
                            token.refresh_token = new_refresh
                        token.created_at = datetime.utcnow()
                        token.expires_at = datetime.utcnow() + timedelta(days=1)
                        db.commit()
                        is_connected = True
                        is_expired = False
                        was_refreshed = True
                        print(f"[FYERS_STATUS] Token refreshed successfully for user {current_user.id}")
                else:
                    print(f"[FYERS_STATUS] Refresh failed for user {current_user.id}: {refresh_result}")

    return {
        "connected": is_connected,
        "connected_at": token.created_at if token else None,
        "expires_at": token.expires_at if token else None,
        "is_expired": is_expired,
        "was_refreshed": was_refreshed,
    }

@router.get("/callback")
async def fyers_callback(
    request: Request,
    s: str = Query(...),  # status (ok/error)
    code: str = Query(None), # status code from Fyers (usually '200')
    auth_code: str = Query(None), # the actual Fyers auth code
    id: str = Query(None),   # fyers_id
    state: str = Query(None), # our JWT token passed as state
    db: Session = Depends(get_db)
):
    """
    Handle Fyers OAuth callback.
    Fyers returns: ?s=ok&code=200&auth_code=<fyers_auth_jwt>&state=<our_jwt>
    """
    from routes.deps import SECRET_KEY, ALGORITHM
    from jose import JWTError, jwt
    import urllib.parse
    
    # Log all received params for debugging
    all_params = dict(request.query_params)
    print(f"[FYERS_CALLBACK] Received params: {all_params}")
    print(f"[FYERS_CALLBACK] s={s}, code={code}, auth_code_len={len(auth_code) if auth_code else 0}, state_len={len(state) if state else 0}")
    
    # Step 1: Identify our JWT state and Fyers auth code
    our_jwt = None
    fyers_auth_code = None
    
    # The state parameter should be our JWT (starts with 'eyJ')
    if state and state.startswith('eyJ'):
        our_jwt = state
        print(f"[FYERS_CALLBACK] Found our JWT in 'state' parameter")
    
    # auth_code from Fyers is the authorization code we need
    # It also starts with 'eyJ' but it's Fyers' format, not our JWT
    if auth_code:
        # If we already have our JWT from state, then auth_code is definitely the Fyers code
        if our_jwt:
            fyers_auth_code = auth_code
            print(f"[FYERS_CALLBACK] auth_code is Fyers auth code (state found)")
        else:
            # No state found - try to decode auth_code as our JWT
            try:
                payload = jwt.decode(auth_code, SECRET_KEY, algorithms=[ALGORITHM])
                # Successfully decoded - this is our JWT, but we don't have the Fyers code
                our_jwt = auth_code
                print(f"[FYERS_CALLBACK] auth_code is OUR JWT - no Fyers code found!")
            except Exception as e:
                # Not our JWT - treat as Fyers auth code
                fyers_auth_code = auth_code
                print(f"[FYERS_CALLBACK] auth_code is NOT our JWT, treating as Fyers code: {e}")
    
    # Step 2: Get user from our JWT
    current_user = None
    if our_jwt:
        try:
            payload = jwt.decode(our_jwt, SECRET_KEY, algorithms=[ALGORITHM])
            user_id = int(payload.get("sub"))
            current_user = db.query(User).filter(User.id == user_id).first()
            print(f"[FYERS_CALLBACK] User found: {current_user.email if current_user else 'None'}")
        except Exception as e:
            print(f"[FYERS_CALLBACK] JWT decode failed: {e}")
            return RedirectResponse(url=f"/app/?fyers_error=jwt_decode_failed&detail={urllib.parse.quote(str(e))}")
    
    if not current_user:
        print(f"[FYERS_CALLBACK] No user found from JWT")
        return RedirectResponse(url="/app/?fyers_error=user_not_found")
    
    # Step 3: Validate status
    if s != "ok":
        print(f"[FYERS_CALLBACK] Status not ok: {s}")
        return RedirectResponse(url=f"/app/?fyers_error=status_{s}")
    
    # Step 4: Check Fyers auth code
    if not fyers_auth_code:
        print(f"[FYERS_CALLBACK] No Fyers auth code found! Params: {all_params}")
        return RedirectResponse(url="/app/?fyers_error=no_auth_code")
    
    # Step 5: Exchange Fyers auth code for access token
    print(f"[FYERS_CALLBACK] Exchanging auth code for token...")
    token_data = generate_fyers_access_token(fyers_auth_code)
    print(f"[FYERS_CALLBACK] Token response: {token_data}")
    
    if not token_data:
        return RedirectResponse(url="/app/?fyers_error=token_exchange_failed")
    
    if token_data.get("s") != "ok":
        error_msg = token_data.get('message', 'Unknown error')
        error_code = token_data.get('code', 'no_code')
        print(f"[FYERS_CALLBACK] Token error: code={error_code}, message={error_msg}")
        return RedirectResponse(url=f"/app/?fyers_error={urllib.parse.quote(error_msg)}")

    access_token = token_data.get("access_token")
    refresh_token = token_data.get("refresh_token")
    
    if not access_token:
        print(f"[FYERS_CALLBACK] No access token in response")
        return RedirectResponse(url="/app/?fyers_error=no_access_token_in_response")
    
    # Step 6: Store or update token
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
    print(f"[FYERS_CALLBACK] Success! Token saved for user {current_user.email}")
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

@router.get("/all-stocks")
async def get_all_fyers_stocks(
    current_user: User = Depends(get_current_user)
):
    """Return the full list of Fyers symbols.
    If the local master CSV is missing or stale, it will be downloaded.
    """
    # Ensure the master file exists; download if needed
    from services.fyers_service import download_fyers_master, get_fyers_symbols, SYM_MASTER_FO
    import os, asyncio
    if not os.path.exists(SYM_MASTER_FO):
        # Await the async download directly
        await download_fyers_master()
    symbols = get_fyers_symbols()
    # Return only the symbol strings for simplicity
    return {"stocks": [s.get("symbol") for s in symbols]}

