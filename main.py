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
# from routes.fyers import router as fyers_router  # Temporarily disabled - requires fyers_apiv3
from routes.deps import get_current_user

from services.request_logger import RequestLogger
from database.connection import engine, Base
from database import models  # Import models to register them
import os
import time
import uuid

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Stock Services API", version="1.0.0")
request_logger = RequestLogger()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(nse_data_router, dependencies=protected)
app.include_router(market_data_router, dependencies=protected)
app.include_router(logs_router, dependencies=protected)
# app.include_router(fyers_router, dependencies=protected)  # Temporarily disabled



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
        return response
    except Exception as exc:
        error_message = str(exc)
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
async def root():
    """Redirect to React app (if built) or legacy frontend"""
    if os.path.exists(REACT_INDEX):
        return RedirectResponse(url="/app/")
    return RedirectResponse(url="/static/index.html")


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
