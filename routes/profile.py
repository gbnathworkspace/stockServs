import json
from fastapi import APIRouter, Depends
from pydantic import BaseModel, HttpUrl
from sqlalchemy.orm import Session
from database.connection import get_db
from database.models import UserProfile
from routes.deps import get_current_user

router = APIRouter(prefix="/profile", tags=["User Profile"])


class ProfileUpdate(BaseModel):
    display_name: str | None = None
    avatar_url: HttpUrl | None = None
    preferences: dict | None = None


def serialize_profile(profile: UserProfile):
    return {
        "user_id": profile.user_id,
        "display_name": profile.display_name,
        "avatar_url": profile.avatar_url,
        "preferences": json.loads(profile.preferences) if profile.preferences else {},
        "created_at": profile.created_at,
        "updated_at": profile.updated_at,
    }


def ensure_profile(user_id: int, db: Session) -> UserProfile:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user_id).first()
    if not profile:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


@router.get("/me")
async def get_profile(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    """
    Fetch the current user's profile.
    """
    profile = ensure_profile(current_user.id, db)
    return {"profile": serialize_profile(profile)}


@router.put("/me")
async def update_profile(
    payload: ProfileUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Update the current user's profile and preferences.
    """
    profile = ensure_profile(current_user.id, db)

    if payload.display_name is not None:
        profile.display_name = payload.display_name
    if payload.avatar_url is not None:
        profile.avatar_url = str(payload.avatar_url)
    if payload.preferences is not None:
        profile.preferences = json.dumps(payload.preferences)

    db.commit()
    db.refresh(profile)

    return {"profile": serialize_profile(profile)}
