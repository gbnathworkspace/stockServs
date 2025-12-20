from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import User, UserProfile

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/")
async def get_users(db: Session = Depends(get_db)):
    """Fetch all users"""
    users = db.query(User).all()
    return {"users": users}

@router.post("/", status_code=201)
async def create_user(email: str | None = None, db: Session = Depends(get_db)):
    """
    Create a new user record (minimal profile stub).
    """
    user = User(email=email)
    db.add(user)
    db.commit()
    db.refresh(user)

    # Ensure a matching profile exists
    profile = UserProfile(user_id=user.id)
    db.add(profile)
    db.commit()

    return {"user_id": user.id, "email": user.email}

@router.get("/{user_id}")
async def get_user(user_id: int, db: Session = Depends(get_db)):
    """Fetch a single user by id"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user}
    
