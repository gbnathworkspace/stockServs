import os
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from jose import JWTError, jwt
import bcrypt
from pydantic import BaseModel, EmailStr
from google.oauth2 import id_token as google_id_token
from google.auth.transport import requests as google_requests
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import User, ZerodhaToken, LocalCredential, UserProfile
from routes.deps import get_current_user
from services.zerodha_service import get_zerodha_login_url, generate_access_token


router= APIRouter(prefix="/auth/zerodha", tags=["Authentication"])
auth_router = APIRouter(prefix="/auth", tags=["Auth"])

SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-key")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")


class SignupPayload(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None


class GooglePayload(BaseModel):
    id_token: str


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if "sub" in to_encode:
        to_encode["sub"] = str(to_encode["sub"])
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8')[:72],
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    if password and len(password) > 72:
        raise HTTPException(status_code=400, detail="Password too long (max 72 chars for bcrypt)")
    return bcrypt.hashpw(
        password.encode('utf-8')[:72],
        bcrypt.gensalt()
    ).decode('utf-8')


def ensure_profile(user: User, db: Session):
    existing = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    if not existing:
        profile = UserProfile(user_id=user.id, display_name=user.email)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return

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
        new_user = User(email=None)
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


@auth_router.post("/signup")
async def signup(payload: SignupPayload, db: Session = Depends(get_db)):
    existing = db.query(LocalCredential).filter(LocalCredential.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(email=payload.email)
    db.add(user)
    db.commit()
    db.refresh(user)

    cred = LocalCredential(
        user_id=user.id,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
    )
    db.add(cred)
    db.commit()

    ensure_profile(user, db)

    token = create_access_token({"sub": user.id, "email": payload.email})
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": payload.email}}


@auth_router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Standard username/password login. username == email.
    """
    cred = db.query(LocalCredential).filter(LocalCredential.email == form_data.username).first()
    if not cred or not cred.password_hash:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(form_data.password[:72], cred.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = db.query(User).filter(User.id == cred.user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid user")

    token = create_access_token({"sub": user.id, "email": cred.email})
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": cred.email}}


@auth_router.post("/google")
async def google_sign_in(payload: GooglePayload, db: Session = Depends(get_db)):
    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=500, detail="Google client id not configured on server")

    try:
        idinfo = google_id_token.verify_oauth2_token(payload.id_token, google_requests.Request(), GOOGLE_CLIENT_ID)
        sub = idinfo["sub"]
        email = idinfo.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Google token missing email")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Google token")

    cred = db.query(LocalCredential).filter(LocalCredential.google_sub == sub).first()
    if not cred and email:
        cred = db.query(LocalCredential).filter(LocalCredential.email == email).first()

    if not cred:
        user = User(email=email)
        db.add(user)
        db.commit()
        db.refresh(user)

        cred = LocalCredential(user_id=user.id, email=email, google_sub=sub)
        db.add(cred)
        db.commit()
    else:
        user = db.query(User).filter(User.id == cred.user_id).first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        if cred.google_sub != sub:
            cred.google_sub = sub
            db.commit()

    ensure_profile(user, db)

    token = create_access_token({"sub": user.id, "email": cred.email, "google": True})
    return {"access_token": token, "token_type": "bearer", "user": {"id": user.id, "email": cred.email}}


@auth_router.get("/me")
async def me(current_user=Depends(get_current_user)):
    return {"user": {"id": current_user.id, "email": current_user.email}}
