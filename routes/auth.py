from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import User, ZerodhaToken
from services.zerodha_service import get_zerodha_login_url, generate_access_token


router= APIRouter(prefix="/auth/zerodha", tags=["Authentication"])

@router.get("/login")
async def zerodha_login():
    """
    Generate Zerodha login URL
    returns: Login URL
    """
    login_url = get_zerodha_login_url()
    return {"login_url": login_url}

@router.get("/callback")
async def zerodha_callback(request_token: str, status: str, db: Session = Depends(get_db)):
    """Callback endpoint to handle Zerodha login"""

    # Check if login was successful
    if status != "success":
        raise HTTPException(status_code=400, detail="Login failed or was cancelled")

    # Generate access token
    token_data = generate_access_token(request_token)
    if not token_data:
        raise HTTPException(status_code=400, detail="Failed to generate access token")

    # Check if user already exists
    zerodha_token = db.query(ZerodhaToken).filter(
        ZerodhaToken.zerodha_user_id == token_data['user_id']
    ).first()

    if zerodha_token:
        # Update existing token
        zerodha_token.access_token = token_data['access_token']
    else:
        # Create new user and token
        new_user = User()
        db.add(new_user)
        db.commit()
        db.refresh(new_user)

        zerodha_token = ZerodhaToken(
            user_id=new_user.id,  # ✅ Fixed!
            access_token=token_data['access_token'],
            zerodha_user_id=token_data['user_id']
        )
        db.add(zerodha_token)

    db.commit()
    return {"message": "Login successful!", "user_id": token_data['user_id']}
