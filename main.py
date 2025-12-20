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
from routes.deps import get_current_user
import os

app = FastAPI(title="Stock Services API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Paths
BASE_DIR = os.path.dirname(__file__)
REACT_APP_PATH = os.path.join(BASE_DIR, "static", "app")
REACT_INDEX = os.path.join(REACT_APP_PATH, "index.html")
REACT_ASSETS = os.path.join(REACT_APP_PATH, "assets")

# Mount static files (legacy HTML frontend)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Mount React app assets directly (JS, CSS files)
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


@app.get("/")
async def root():
    """Redirect to React app (if built) or legacy frontend"""
    if os.path.exists(REACT_INDEX):
        return RedirectResponse(url="/app/")
    return RedirectResponse(url="/static/index.html")


# SPA catch-all route - serves index.html for all /app/* routes
@app.get("/app/{full_path:path}")
async def serve_react_app(full_path: str):
    """Serve React app index.html for all client-side routes"""
    if os.path.exists(REACT_INDEX):
        return FileResponse(REACT_INDEX, media_type="text/html")
    return HTMLResponse(content="<h1>React app not built</h1><p>Run 'npm run build' in the frontend directory.</p>", status_code=404)


@app.get("/health")
async def health_check():
    return {"status": "alive", "service": "stock_servs"}


@app.get("/setup-database")
async def setup_database():
    """One-time endpoint to create database tables"""
    from setup_db import setup_database
    result = setup_database()
    return result
