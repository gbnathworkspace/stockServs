from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel

from database.connection import get_db
from database.models import Watchlist, WatchlistStock, User
from routes.deps import get_current_user
from services.cache import (
    cache, 
    watchlist_all_key, 
    watchlist_stocks_key,
    TTL_WATCHLIST,
    TTL_WATCHLIST_STOCKS
)


router = APIRouter(prefix="/watchlist", tags=["Watchlist"])

# Pydantic schemas
class WatchlistCreate(BaseModel):
    name: str
    position: int

class WatchlistUpdate(BaseModel):
    name: str

class WatchlistResponse(BaseModel):
    id: int
    name: str
    position: int
    stock_count: int
    created_at: str
    updated_at: str

class StockAdd(BaseModel):
    symbol: str

class WatchlistStockResponse(BaseModel):
    symbol: str
    position: int
    added_at: str
    # Live price data will be merged in the response
    lastPrice: Optional[float] = None
    pChange: Optional[float] = None


@router.get("")
async def get_watchlists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all user watchlists with stock counts."""
    # Check cache first
    cache_key = watchlist_all_key(current_user.id)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    
    # Cache miss - fetch from database
    watchlists = (
        db.query(Watchlist)
        .filter(Watchlist.user_id == current_user.id)
        .order_by(Watchlist.position)
        .all()
    )
    
    result = []
    for wl in watchlists:
        stock_count = db.query(WatchlistStock).filter(WatchlistStock.watchlist_id == wl.id).count()
        result.append({
            "id": wl.id,
            "name": wl.name,
            "position": wl.position,
            "stock_count": stock_count,
            "created_at": wl.created_at.isoformat() if wl.created_at else None,
            "updated_at": wl.updated_at.isoformat() if wl.updated_at else None,
        })
    
    response = {"watchlists": result}
    
    # Cache the result
    cache.set(cache_key, response, TTL_WATCHLIST)
    
    return response



@router.post("")
async def create_watchlist(
    data: WatchlistCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new watchlist."""
    # Check if user already has 15 watchlists
    count = db.query(Watchlist).filter(Watchlist.user_id == current_user.id).count()
    if count >= 15:
        raise HTTPException(status_code=400, detail="Maximum 15 watchlists allowed")
    
    # Check if position is already taken
    existing = (
        db.query(Watchlist)
        .filter(Watchlist.user_id == current_user.id, Watchlist.position == data.position)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Position already occupied")
    
    watchlist = Watchlist(
        user_id=current_user.id,
        name=data.name,
        position=data.position
    )
    db.add(watchlist)
    db.commit()
    db.refresh(watchlist)
    
    # Invalidate cache - new watchlist added
    cache.delete(watchlist_all_key(current_user.id))
    
    return {
        "id": watchlist.id,
        "name": watchlist.name,
        "position": watchlist.position,
        "stock_count": 0,
        "created_at": watchlist.created_at.isoformat(),
        "updated_at": watchlist.updated_at.isoformat(),
    }


@router.put("/{watchlist_id}")
async def update_watchlist(
    watchlist_id: int,
    data: WatchlistUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Rename a watchlist."""
    watchlist = (
        db.query(Watchlist)
        .filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id)
        .first()
    )
    
    if not watchlist:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    
    watchlist.name = data.name
    db.commit()
    db.refresh(watchlist)
    
    stock_count = db.query(WatchlistStock).filter(WatchlistStock.watchlist_id == watchlist.id).count()
    
    # Invalidate cache - watchlist name changed
    cache.delete(watchlist_all_key(current_user.id))
    cache.delete(watchlist_stocks_key(current_user.id, watchlist_id))
    
    return {
        "id": watchlist.id,
        "name": watchlist.name,
        "position": watchlist.position,
        "stock_count": stock_count,
        "created_at": watchlist.created_at.isoformat(),
        "updated_at": watchlist.updated_at.isoformat(),
    }


@router.delete("/{watchlist_id}")
async def delete_watchlist(
    watchlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a watchlist and all its stocks."""
    watchlist = (
        db.query(Watchlist)
        .filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id)
        .first()
    )
    
    if not watchlist:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    
    db.delete(watchlist)
    db.commit()
    
    # Invalidate cache - watchlist deleted
    cache.delete(watchlist_all_key(current_user.id))
    cache.delete(watchlist_stocks_key(current_user.id, watchlist_id))
    
    return {"message": "Watchlist deleted successfully"}


@router.get("/{watchlist_id}/stocks")
async def get_watchlist_stocks(
    watchlist_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all stocks in a watchlist with live prices."""
    # Check cache first
    cache_key = watchlist_stocks_key(current_user.id, watchlist_id)
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    
    # Cache miss - fetch from database
    # Verify ownership
    watchlist = (
        db.query(Watchlist)
        .filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id)
        .first()
    )
    
    if not watchlist:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    
    stocks = (
        db.query(WatchlistStock)
        .filter(WatchlistStock.watchlist_id == watchlist_id)
        .order_by(WatchlistStock.position)
        .all()
    )
    
    # Return symbols - frontend will fetch live prices
    result = []
    for stock in stocks:
        result.append({
            "symbol": stock.symbol,
            "position": stock.position,
            "added_at": stock.added_at.isoformat() if stock.added_at else None,
        })
    
    response = {
        "watchlist_id": watchlist_id,
        "watchlist_name": watchlist.name,
        "stocks": result
    }
    
    # Cache the result
    cache.set(cache_key, response, TTL_WATCHLIST_STOCKS)
    
    return response



@router.post("/{watchlist_id}/stocks")
async def add_stock_to_watchlist(
    watchlist_id: int,
    data: StockAdd,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a stock to watchlist."""
    # Verify ownership
    watchlist = (
        db.query(Watchlist)
        .filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id)
        .first()
    )
    
    if not watchlist:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    
    # Check if stock already exists in watchlist
    existing = (
        db.query(WatchlistStock)
        .filter(
            WatchlistStock.watchlist_id == watchlist_id,
            WatchlistStock.symbol == data.symbol.upper()
        )
        .first()
    )
    
    if existing:
        raise HTTPException(status_code=400, detail="Stock already in watchlist")
    
    # Get next position
    max_pos = (
        db.query(WatchlistStock.position)
        .filter(WatchlistStock.watchlist_id == watchlist_id)
        .order_by(WatchlistStock.position.desc())
        .first()
    )
    next_position = (max_pos[0] + 1) if max_pos else 0
    
    stock = WatchlistStock(
        watchlist_id=watchlist_id,
        symbol=data.symbol.upper(),
        position=next_position
    )
    db.add(stock)
    db.commit()
    db.refresh(stock)
    
    # Invalidate cache - stock added
    cache.delete(watchlist_all_key(current_user.id))  # Count changed
    cache.delete(watchlist_stocks_key(current_user.id, watchlist_id))
    
    return {
        "symbol": stock.symbol,
        "position": stock.position,
        "added_at": stock.added_at.isoformat(),
    }


@router.delete("/{watchlist_id}/stocks/{symbol}")
async def remove_stock_from_watchlist(
    watchlist_id: int,
    symbol: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Remove a stock from watchlist."""
    # Verify ownership
    watchlist = (
        db.query(Watchlist)
        .filter(Watchlist.id == watchlist_id, Watchlist.user_id == current_user.id)
        .first()
    )
    
    if not watchlist:
        raise HTTPException(status_code=404, detail="Watchlist not found")
    
    stock = (
        db.query(WatchlistStock)
        .filter(
            WatchlistStock.watchlist_id == watchlist_id,
            WatchlistStock.symbol == symbol.upper()
        )
        .first()
    )
    
    if not stock:
        raise HTTPException(status_code=404, detail="Stock not found in watchlist")
    
    db.delete(stock)
    db.commit()
    
    # Invalidate cache - stock removed
    cache.delete(watchlist_all_key(current_user.id))  # Count changed
    cache.delete(watchlist_stocks_key(current_user.id, watchlist_id))
    
    return {"message": f"{symbol} removed from watchlist"}


@router.post("/initialize")
async def initialize_default_watchlists(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Initialize default watchlist with top 5 stocks for new users."""
    # Check if user already has watchlists
    existing = db.query(Watchlist).filter(Watchlist.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Watchlists already initialized")
    
    # Create Watchlist 1
    watchlist = Watchlist(
        user_id=current_user.id,
        name="Watchlist 1",
        position=0
    )
    db.add(watchlist)
    db.commit()
    db.refresh(watchlist)
    
    # Add top 5 stocks
    default_stocks = ["RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK"]
    for i, symbol in enumerate(default_stocks):
        stock = WatchlistStock(
            watchlist_id=watchlist.id,
            symbol=symbol,
            position=i
        )
        db.add(stock)
    
    db.commit()
    
    return {
        "message": "Default watchlist created",
        "watchlist_id": watchlist.id,
        "stocks": default_stocks
    }
