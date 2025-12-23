from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database.connection import get_db
from database.models import ApiLog, ErrorLog
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


def serialize_error_log(log: ErrorLog) -> dict:
    return {
        "id": log.id,
        "endpoint": log.endpoint,
        "method": log.method,
        "status_code": log.status_code,
        "error_type": log.error_type,
        "error_message": log.error_message,
        "query_params": log.query_params,
        "client_ip": log.client_ip,
        "user_agent": log.user_agent,
        "user_id": log.user_id,
        "extra_data": log.extra_data,
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


@router.get("/errors")
async def get_error_logs(
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    status_code: int = Query(None),
    endpoint: str = Query(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Get error logs with optional filtering by status code or endpoint."""
    query = db.query(ErrorLog)
    
    if status_code:
        query = query.filter(ErrorLog.status_code == status_code)
    if endpoint:
        query = query.filter(ErrorLog.endpoint.like(f"%{endpoint}%"))
    
    logs = (
        query
        .order_by(ErrorLog.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return {"errors": [serialize_error_log(log) for log in logs], "total": len(logs)}

