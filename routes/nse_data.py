from fastapi import APIRouter
from nse_data.movers import router as movers_router
from nse_data.fii_dii import router as fii_dii_router
from nse_data.most_active import router as most_active_router
from nse_data.high_low import router as high_low_router
from nse_data.bulk_deals import router as bulk_deals_router

router = APIRouter(prefix="/nse_data", tags=["NSE Data"])


router.include_router(movers_router, prefix="", tags=["Movers"])
router.include_router(fii_dii_router, prefix="", tags=["FII/DII"])
router.include_router(most_active_router, prefix="", tags=["Most Active"])
router.include_router(high_low_router, prefix="", tags=["52-Week High/Low"])
router.include_router(bulk_deals_router, prefix="", tags=["Bulk/Block Deals"])


@router.get("/status")
async def get_nse_status():
    """Check NSE data service status"""
    return {"status": "NSE data service is running"}