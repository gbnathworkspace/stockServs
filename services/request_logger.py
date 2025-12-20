import os
import uuid
from datetime import datetime
from typing import Optional

from jose import JWTError, jwt
from starlette.requests import Request

from database.connection import SessionLocal
from database.models import ApiLog


class RequestLogger:
    def __init__(self, session_factory=SessionLocal):
        self._session_factory = session_factory
        self._skip_prefixes = ("/static", "/app", "/docs", "/redoc")
        self._skip_paths = {"/health", "/openapi.json", "/favicon.ico"}

    def should_skip(self, path: str) -> bool:
        if path in self._skip_paths:
            return True
        return path.startswith(self._skip_prefixes)

    def _get_user_id_from_request(self, request: Request) -> Optional[int]:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return None
        token = auth_header.replace("Bearer ", "", 1).strip()
        if not token:
            return None

        secret_key = os.getenv("JWT_SECRET", "dev-secret-key")
        algorithm = "HS256"
        try:
            payload = jwt.decode(token, secret_key, algorithms=[algorithm])
            sub = payload.get("sub")
            if sub is None:
                return None
            return int(sub)
        except (JWTError, ValueError, TypeError):
            return None

    def log_request(
        self,
        request: Request,
        status_code: int,
        duration_ms: int,
        error: Optional[str],
        request_id: Optional[str] = None,
    ) -> None:
        if self.should_skip(request.url.path):
            return

        log_request_id = request_id or request.headers.get("X-Request-Id") or str(uuid.uuid4())
        user_id = self._get_user_id_from_request(request)
        client_ip = request.client.host if request.client else None

        db = None
        try:
            db = self._session_factory()
            db.add(
                ApiLog(
                    request_id=log_request_id,
                    path=request.url.path,
                    method=request.method,
                    status_code=status_code,
                    duration_ms=duration_ms,
                    client_ip=client_ip,
                    user_id=user_id,
                    error=error,
                    created_at=datetime.utcnow(),
                )
            )
            db.commit()
        except Exception:
            # Logging should never break the request flow.
            pass
        finally:
            try:
                if db is not None:
                    db.close()
            except Exception:
                pass
