from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from routes.auth import router as auth_router
from routes.holdings import router as holdings_router
from routes.users import router as users_router
from routes.nse_data import router as nse_data_router

app = FastAPI(title="Stock Services API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Include routers
app.include_router(auth_router)
app.include_router(holdings_router)
app.include_router(users_router)
app.include_router(nse_data_router)

@app.get("/")
async def root():
    return RedirectResponse(url="/static/index.html")


@app.get("/health")
async def health_check():
    return {"status": "alive", "service": "stock_servs"}


@app.get("/setup-database")
async def setup_database():
    """One-time endpoint to create database tables"""
    from setup_db import setup_database
    result = setup_database()
    return result


