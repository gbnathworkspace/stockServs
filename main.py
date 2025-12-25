from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse, FileResponse, HTMLResponse
from routes.auth import router as auth_router, auth_router as core_auth_router
from routes.holdings import router as holdings_router
from routes.users import router as users_router
from routes.nse_data import router as nse_data_router
from routes.profile import router as profile_router
from routes.portfolio import router as portfolio_router
from routes.market_data import router as market_data_router
from routes.logs import router as logs_router
from routes.fyers import router as fyers_router
from routes.option_clock import router as option_clock_router
from routes.watchlist import router as watchlist_router
from routes.deps import get_current_user

from services.request_logger import RequestLogger
from services.fii_dii_scheduler import start_fii_dii_scheduler, stop_fii_dii_scheduler
from services.data_scheduler import data_scheduler
from database.connection import engine, Base
from database import models  # Import models to register them
import os
import time
import uuid

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Stock Services API", version="1.0.0")
request_logger = RequestLogger()

# CORS Configuration - secure defaults with environment override
# In production, set ALLOWED_ORIGINS env var to your frontend domain(s)
# Example: ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com
cors_origins_env = os.getenv("ALLOWED_ORIGINS", "")
if cors_origins_env:
    # Production: use specific origins from environment
    allowed_origins = [origin.strip() for origin in cors_origins_env.split(",") if origin.strip()]
else:
    # Development: allow common localhost origins
    allowed_origins = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "http://192.168.1.7:5173",
        "http://192.168.1.7:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Authorization", "Content-Type", "X-Request-Id", "Accept"],
)

# Paths - use absolute path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
REACT_APP_PATH = os.path.join(BASE_DIR, "static", "app")
REACT_INDEX = os.path.join(REACT_APP_PATH, "index.html")
REACT_ASSETS = os.path.join(REACT_APP_PATH, "assets")

# Debug: Check if React app exists at startup
print(f"[DEBUG] BASE_DIR: {BASE_DIR}")
print(f"[DEBUG] REACT_INDEX exists: {os.path.exists(REACT_INDEX)}")
print(f"[DEBUG] REACT_ASSETS exists: {os.path.exists(REACT_ASSETS)}")
if os.path.exists(REACT_APP_PATH):
    print(f"[DEBUG] Contents of static/app: {os.listdir(REACT_APP_PATH)}")

# Mount static files (legacy HTML frontend)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Mount React app assets directly (JS, CSS files) if they exist
if os.path.exists(REACT_ASSETS):
    app.mount("/app/assets", StaticFiles(directory=REACT_ASSETS), name="react_assets")

# Include routers
protected = [Depends(get_current_user)]

app.include_router(auth_router)
app.include_router(core_auth_router)
app.include_router(holdings_router, dependencies=protected)
app.include_router(users_router, dependencies=protected)
app.include_router(profile_router, dependencies=protected)
app.include_router(portfolio_router, dependencies=protected)
app.include_router(watchlist_router, dependencies=protected)
app.include_router(nse_data_router, dependencies=protected)
app.include_router(market_data_router, dependencies=protected)
app.include_router(logs_router, dependencies=protected)
app.include_router(option_clock_router, dependencies=protected)  # Option Clock requires auth
app.include_router(fyers_router)  # No global auth - fyers handles its own auth (callback needs to be public)


@app.on_event("startup")
async def startup_event():
    start_fii_dii_scheduler()


@app.on_event("shutdown")
async def shutdown_event():
    stop_fii_dii_scheduler()


@app.middleware("http")
async def log_requests(request: Request, call_next):
    if request_logger.should_skip(request.url.path):
        return await call_next(request)

    start_time = time.perf_counter()
    status_code = 500
    error_message = None
    request_id = request.headers.get("X-Request-Id") or str(uuid.uuid4())

    try:
        response = await call_next(request)
        status_code = response.status_code
        
        # Log non-2xx/3xx responses to error_logs table
        if status_code >= 400:
            try:
                from database.connection import SessionLocal
                from database.models import ErrorLog
                import json
                
                db = SessionLocal()
                try:
                    error_log = ErrorLog(
                        endpoint=str(request.url.path)[:255],
                        method=request.method,
                        status_code=status_code,
                        error_type="HTTPError",
                        error_message=f"HTTP {status_code} response",
                        query_params=str(request.query_params)[:2000] if request.query_params else None,
                        client_ip=request.client.host if request.client else None,
                        user_agent=request.headers.get("user-agent", "")[:500],
                        extra_data=json.dumps({
                            "request_id": request_id,
                            "headers": dict(request.headers),
                            "path": str(request.url)
                        })
                    )
                    db.add(error_log)
                    db.commit()
                except Exception as log_err:
                    print(f"[ERROR_LOG] Failed to log error: {log_err}")
                    db.rollback()
                finally:
                    db.close()
            except Exception as e:
                print(f"[ERROR_LOG] Error logging failed: {e}")
        
        return response
    except Exception as exc:
        error_message = str(exc)
        
        # Log exceptions to error_logs table  
        try:
            from database.connection import SessionLocal
            from database.models import ErrorLog
            import json
            
            db = SessionLocal()
            try:
                error_log = ErrorLog(
                    endpoint=str(request.url.path)[:255],
                    method=request.method,
                    status_code=500,
                    error_type=type(exc).__name__,
                    error_message=str(exc)[:2000],
                    query_params=str(request.query_params)[:2000] if request.query_params else None,
                    client_ip=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent", "")[:500],
                    extra_data=json.dumps({
                        "request_id": request_id,
                        "exception_type": type(exc).__name__
                    })
                )
                db.add(error_log)
                db.commit()
            except Exception as log_err:
                print(f"[ERROR_LOG] Failed to log exception: {log_err}")
                db.rollback()
            finally:
                db.close()
        except Exception as e:
            print(f"[ERROR_LOG] Exception logging failed: {e}")
        
        raise
    finally:
        duration_ms = int((time.perf_counter() - start_time) * 1000)
        request_logger.log_request(
            request=request,
            status_code=status_code,
            duration_ms=duration_ms,
            error=error_message,
            request_id=request_id,
        )


@app.get("/")
async def root(request: Request):
    """Redirect to React app (if built) or legacy frontend with query params preserved"""
    query_params = str(request.query_params)
    
    # Check if this is a Fyers OAuth callback (redirect from Fyers login)
    # Fyers sends: ?s=ok&auth_code=xxx&state=jwt_token
    s_param = request.query_params.get("s")
    auth_code = request.query_params.get("auth_code") or request.query_params.get("code")
    state = request.query_params.get("state")
    
    if s_param and auth_code and state:
        # This is a Fyers callback - forward to the callback endpoint
        return RedirectResponse(url=f"/fyers/callback?{query_params}")
    
    target = "/app/" if os.path.exists(REACT_INDEX) else "/static/index.html"
    if query_params:
        target = f"{target}?{query_params}"
    return RedirectResponse(url=target)



def serve_react():
    """Helper to serve React index.html"""
    if os.path.exists(REACT_INDEX):
        return FileResponse(REACT_INDEX, media_type="text/html")
    return HTMLResponse(
        content="<h1>React app not built</h1><p>Run 'npm run build' in the frontend directory.</p>", 
        status_code=404
    )


# SPA routes - serve index.html for all /app/* routes
@app.get("/app/")
async def serve_react_root():
    """Serve React app for /app/"""
    return serve_react()


@app.get("/app/{full_path:path}")
async def serve_react_app(full_path: str):
    """Serve React app index.html for all client-side routes"""
    return serve_react()


@app.get("/health")
async def health_check():
    return {"status": "alive", "service": "stock_servs"}


@app.get("/debug/static")
async def debug_static():
    """Debug endpoint to check static file status"""
    return {
        "base_dir": BASE_DIR,
        "react_app_path": REACT_APP_PATH,
        "react_index_exists": os.path.exists(REACT_INDEX),
        "react_assets_exists": os.path.exists(REACT_ASSETS),
        "static_app_contents": os.listdir(REACT_APP_PATH) if os.path.exists(REACT_APP_PATH) else [],
        "static_contents": os.listdir(os.path.join(BASE_DIR, "static")) if os.path.exists(os.path.join(BASE_DIR, "static")) else [],
    }


@app.get("/setup-database")
async def setup_database():
    """One-time endpoint to create database tables"""
    from setup_db import setup_database
    result = setup_database()
    return result


# Background Data Scheduler - starts automatically with the app
@app.on_event("startup")
async def startup_event():
    """Start background data scheduler on app startup."""
    data_scheduler.start()
    print("[STARTUP] Background data scheduler initialized")


@app.on_event("shutdown")
async def shutdown_event():
    """Stop background data scheduler on app shutdown."""
    data_scheduler.stop()
    print("[SHUTDOWN] Background data scheduler stopped")


@app.get("/scheduler/status")
async def get_scheduler_status():
    """Get the current status of the background data scheduler."""
    return data_scheduler.get_status()


@app.post("/scheduler/fetch")
async def trigger_scheduler_fetch():
    """Manually trigger a data fetch (admin use)."""
    status = await data_scheduler.force_fetch()
    return {"message": "Data fetch triggered", "status": status}
