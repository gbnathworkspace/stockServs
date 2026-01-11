from fastapi import APIRouter
from nse_data.movers import router as movers_router
from nse_data.fii_dii import router as fii_dii_router
from nse_data.most_active import router as most_active_router
from nse_data.high_low import router as high_low_router
from nse_data.bulk_deals import router as bulk_deals_router
from nse_data.indices import router as indices_router
from nse_data.fno import router as fno_router
from nse_data.weekly_gainers import get_weekly_gainers_losers
import asyncio
from concurrent.futures import ThreadPoolExecutor

router = APIRouter(prefix="/nse_data", tags=["NSE Data"])

# Thread pool for blocking operations
_executor = ThreadPoolExecutor(max_workers=4)

router.include_router(movers_router, prefix="", tags=["Movers"])
router.include_router(fii_dii_router, prefix="", tags=["FII/DII"])
router.include_router(most_active_router, prefix="", tags=["Most Active"])
router.include_router(high_low_router, prefix="", tags=["52-Week High/Low"])
router.include_router(bulk_deals_router, prefix="", tags=["Bulk/Block Deals"])
router.include_router(indices_router, prefix="", tags=["Indices"])
router.include_router(fno_router, prefix="/fno", tags=["Futures & Options"])


@router.get("/status")
async def get_nse_status():
    """Check NSE data service status"""
    return {"status": "NSE data service is running"}


@router.get("/weekly-gainers")
async def get_weekly_gainers(days: int = 5):
    """
    Get weekly historical top gainers and losers for NIFTY 100 stocks.
    Returns top 10 gainers and losers for each trading day.
    """
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, get_weekly_gainers_losers, days)
    return result
