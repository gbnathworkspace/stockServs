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


@router.get("/slowest")
async def get_slowest_api_calls(
    limit: int = Query(100, ge=1, le=500),
    hours: int = Query(24, ge=1, le=168),  # Default last 24 hours, max 7 days
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Get top slowest API calls by duration, grouped by endpoint.
    Shows the maximum time taken for each endpoint along with average and call count.
    Useful for diagnosing performance bottlenecks.
    """
    from sqlalchemy import func, desc
    from datetime import datetime, timedelta
    
    # Calculate the time threshold
    time_threshold = datetime.utcnow() - timedelta(hours=hours)
    
    # Query to get slowest endpoints with stats
    slowest_endpoints = (
        db.query(
            ApiLog.path,
            ApiLog.method,
            func.max(ApiLog.duration_ms).label('max_duration_ms'),
            func.avg(ApiLog.duration_ms).label('avg_duration_ms'),
            func.min(ApiLog.duration_ms).label('min_duration_ms'),
            func.count(ApiLog.id).label('call_count'),
            func.sum(ApiLog.duration_ms).label('total_duration_ms'),
        )
        .filter(ApiLog.created_at >= time_threshold)
        .group_by(ApiLog.path, ApiLog.method)
        .order_by(desc('max_duration_ms'))
        .limit(limit)
        .all()
    )
    
    results = []
    for row in slowest_endpoints:
        results.append({
            "endpoint": row.path,
            "method": row.method,
            "max_duration_ms": row.max_duration_ms,
            "avg_duration_ms": round(row.avg_duration_ms, 2) if row.avg_duration_ms else 0,
            "min_duration_ms": row.min_duration_ms,
            "call_count": row.call_count,
            "total_duration_ms": row.total_duration_ms,
        })
    
    # Also get the single slowest individual requests
    slowest_individual = (
        db.query(ApiLog)
        .filter(ApiLog.created_at >= time_threshold)
        .order_by(desc(ApiLog.duration_ms))
        .limit(20)
        .all()
    )
    
    individual_requests = []
    for log in slowest_individual:
        individual_requests.append({
            "id": log.id,
            "endpoint": log.path,
            "method": log.method,
            "duration_ms": log.duration_ms,
            "status_code": log.status_code,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "user_id": log.user_id,
        })
    
    return {
        "time_range_hours": hours,
        "endpoints_by_max_duration": results,
        "slowest_individual_requests": individual_requests,
        "total_endpoints_analyzed": len(results),
    }
