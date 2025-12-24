"""
Error logging service to track API errors in the database.
"""
from sqlalchemy.orm import Session
from database.models import ErrorLog
from datetime import datetime
import json


def log_error(
    db: Session,
    endpoint: str,
    method: str,
    status_code: int,
    error_message: str = None,
    error_type: str = None,
    request_body: str = None,
    query_params: str = None,
    user_id: int = None,
    client_ip: str = None,
    user_agent: str = None,
    extra_data: dict = None
):
    """
    Log an error to the error_logs table.
    
    Args:
        db: Database session
        endpoint: API endpoint path
        method: HTTP method (GET, POST, etc.)
        status_code: HTTP status code
        error_message: Error message/detail
        error_type: Type of error (HTTPException, ValueError, etc.)
        request_body: Request body if applicable
        query_params: Query parameters as string
        user_id: User ID if authenticated
        client_ip: Client IP address
        user_agent: User agent string
        extra_data: Additional context as dict (will be JSON stringified)
    """
    try:
        error_log = ErrorLog(
            endpoint=endpoint[:255] if endpoint else "",
            method=method,
            status_code=status_code,
            error_type=error_type[:100] if error_type else None,
            error_message=error_message,
            request_body=request_body,
            query_params=query_params,
            user_id=user_id,
            client_ip=client_ip[:64] if client_ip else None,
            user_agent=user_agent[:500] if user_agent else None,
            extra_data=json.dumps(extra_data) if extra_data else None,
            created_at=datetime.utcnow()
        )
        db.add(error_log)
        db.commit()
        return error_log.id
    except Exception as e:
        print(f"[ERROR_LOGGER] Failed to log error: {e}")
        db.rollback()
        return None


def get_recent_errors(db: Session, limit: int = 50):
    """Get recent error logs."""
    return db.query(ErrorLog).order_by(ErrorLog.created_at.desc()).limit(limit).all()


def get_errors_by_endpoint(db: Session, endpoint: str, limit: int = 50):
    """Get errors for a specific endpoint."""
    return db.query(ErrorLog).filter(
        ErrorLog.endpoint.like(f"%{endpoint}%")
    ).order_by(ErrorLog.created_at.desc()).limit(limit).all()


def get_errors_by_status(db: Session, status_code: int, limit: int = 50):
    """Get errors by status code."""
    return db.query(ErrorLog).filter(
        ErrorLog.status_code == status_code
    ).order_by(ErrorLog.created_at.desc()).limit(limit).all()
