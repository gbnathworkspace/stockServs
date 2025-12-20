from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import ApiLog
from routes.deps import get_current_user


router = APIRouter(prefix="/logs", tags=["Logs"])


def serialize_log(log: ApiLog) -> dict:
    return {
        "id": log.id,
        "request_id": log.request_id,
        "path": log.path,
        "method": log.method,
        "status_code": log.status_code,
        "duration_ms": log.duration_ms,
        "client_ip": log.client_ip,
        "user_id": log.user_id,
        "error": log.error,
        "created_at": log.created_at,
    }


@router.get("")
async def get_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    logs = (
        db.query(ApiLog)
        .order_by(ApiLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {"logs": [serialize_log(log) for log in logs]}
