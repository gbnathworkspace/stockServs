import os
from fastapi import Depends, Header, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import User

from jose import JWTError, jwt

def require_user(
    user_id_header: int | None = Header(None, alias="X-User-Id"),
    user_id_query: int | None = Query(None, alias="user_id"),
    db: Session = Depends(get_db),
):
    """
    Resolve the current user from header or query param.
    Header takes precedence. Raises 400/404 if missing or not found.
    """
    user_id = user_id_header or user_id_query
    if not user_id:
        raise HTTPException(
            status_code=400,
            detail="user_id missing. Provide X-User-Id header or user_id query param.",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user

# JWT-based current user dependency
security = HTTPBearer(auto_error=False)
SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-key")
ALGORITHM = "HS256"


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
):
    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    try:
        user_id = int(user_id)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user
