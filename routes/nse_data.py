from fastapi import APIRouter
from nse_data.movers import router as movers_router

router = APIRouter(prefix="/nse_data", tags=["NSE Data"])


router.include_router(movers_router, prefix="/movers", tags=["Movers"])


@router.get("/status")
async def get_nse_status():
    """Check NSE data service status"""
    return {"status": "NSE data service is running"}