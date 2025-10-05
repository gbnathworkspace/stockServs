from fastapi import APIRouter, Depends
from requests import Session

from database.connection import get_db
from database.models import User

router = APIRouter(prefix="/users", tags=["Users"])

@router.get("/")
async def get_users(db: Session = Depends(get_db)):
    """Fetch all users"""
    users = db.query(User).all()
    return {"users": users}
    