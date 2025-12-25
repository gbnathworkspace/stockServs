import logging
import os

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from database.connection import SessionLocal
from nse_data.fii_dii import fetch_fii_dii_data, extract_fii_dii_records, store_daily_activity

logger = logging.getLogger(__name__)

_SCHEDULER = AsyncIOScheduler(timezone="Asia/Kolkata")


def _scheduler_enabled() -> bool:
    value = os.getenv("ENABLE_FII_DII_SCHEDULER", "true").strip().lower()
    return value in {"1", "true", "yes", "on"}


async def run_fii_dii_daily_job():
    db = SessionLocal()
    try:
        data = await fetch_fii_dii_data()
        fii_data, dii_data = extract_fii_dii_records(data)
        if not fii_data and not dii_data:
            logger.warning("FII/DII job: no data returned from NSE")
            return
        store_daily_activity(db, fii_data, dii_data)
        logger.info("FII/DII job: stored daily activity")
    except Exception as exc:
        logger.exception("FII/DII job failed: %s", exc)
    finally:
        db.close()


def start_fii_dii_scheduler():
    if not _scheduler_enabled():
        logger.info("FII/DII scheduler disabled by ENABLE_FII_DII_SCHEDULER")
        return
    if _SCHEDULER.running:
        return

    _SCHEDULER.add_job(
        run_fii_dii_daily_job,
        CronTrigger(hour=18, minute=0),
        id="fii_dii_daily",
        replace_existing=True,
    )
    _SCHEDULER.start()
    logger.info("FII/DII scheduler started (daily at 18:00 Asia/Kolkata)")


def stop_fii_dii_scheduler():
    if _SCHEDULER.running:
        _SCHEDULER.shutdown()
        logger.info("FII/DII scheduler stopped")
