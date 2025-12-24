"""
Background Data Scheduler Service
Automatically fetches and stores market data (FII/DII, etc.) without requiring user visits.
"""

import asyncio
import httpx
from datetime import datetime, time as dt_time
from typing import Optional
import threading

from database.connection import SessionLocal
from database.models import FiiDiiActivity


# NSE API URLs
NSE_FII_DII_URL = "https://www.nseindia.com/api/fiidiiTradeReact"

# Headers for NSE requests
NSE_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://www.nseindia.com/"
}


class DataScheduler:
    """
    Background scheduler that fetches market data periodically.
    Runs independently of user requests.
    """

    def __init__(self):
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._loop: Optional[asyncio.AbstractEventLoop] = None
        self.fetch_interval_seconds = 3600  # Fetch every hour
        self.last_fetch_time: Optional[datetime] = None
        self.last_fetch_status: str = "Not started"

    def start(self):
        """Start the background scheduler in a separate thread."""
        if self._running:
            print("[SCHEDULER] Already running")
            return

        self._running = True
        self._thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self._thread.start()
        print("[SCHEDULER] Background data scheduler started")

    def stop(self):
        """Stop the background scheduler."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
        print("[SCHEDULER] Background data scheduler stopped")

    def _run_scheduler(self):
        """Run the async scheduler loop in a separate thread."""
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        try:
            self._loop.run_until_complete(self._scheduler_loop())
        finally:
            self._loop.close()

    async def _scheduler_loop(self):
        """Main scheduler loop - fetches data periodically."""
        print("[SCHEDULER] Scheduler loop started")

        # Initial fetch on startup
        await self._fetch_all_data()

        while self._running:
            try:
                # Wait for the interval
                await asyncio.sleep(self.fetch_interval_seconds)

                # Only fetch during market hours (9 AM - 6 PM IST)
                # and on weekdays
                now = datetime.now()
                if self._is_market_time(now):
                    await self._fetch_all_data()
                else:
                    print(f"[SCHEDULER] Skipping fetch - outside market hours ({now.strftime('%H:%M')})")

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[SCHEDULER] Error in scheduler loop: {e}")
                self.last_fetch_status = f"Error: {str(e)}"

    def _is_market_time(self, now: datetime) -> bool:
        """Check if current time is during market hours (9 AM - 6 PM IST, weekdays)."""
        # Skip weekends (Saturday=5, Sunday=6)
        if now.weekday() >= 5:
            return False

        # Market hours: 9 AM to 6 PM IST
        market_open = dt_time(9, 0)
        market_close = dt_time(18, 0)
        current_time = now.time()

        return market_open <= current_time <= market_close

    async def _fetch_all_data(self):
        """Fetch and store all scheduled data."""
        print(f"[SCHEDULER] Starting data fetch at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        try:
            # Fetch FII/DII data
            await self._fetch_fii_dii_data()

            self.last_fetch_time = datetime.now()
            self.last_fetch_status = "Success"
            print(f"[SCHEDULER] Data fetch completed successfully")

        except Exception as e:
            self.last_fetch_status = f"Error: {str(e)}"
            print(f"[SCHEDULER] Data fetch failed: {e}")

    async def _fetch_fii_dii_data(self):
        """Fetch and store FII/DII activity data."""
        async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
            try:
                # Warm up cookies
                try:
                    await client.get("https://www.nseindia.com", headers=NSE_HEADERS)
                    await asyncio.sleep(0.5)
                except Exception:
                    pass

                # Fetch FII/DII data
                response = await client.get(NSE_FII_DII_URL, headers=NSE_HEADERS)
                response.raise_for_status()
                data = response.json()

                # Parse the response
                fii_data = None
                dii_data = None

                for item in data:
                    if "FII" in item.get("category", ""):
                        fii_data = item
                    elif "DII" in item.get("category", ""):
                        dii_data = item

                # Store in database
                self._store_fii_dii_data(fii_data, dii_data)
                print(f"[SCHEDULER] FII/DII data stored successfully")

            except Exception as e:
                print(f"[SCHEDULER] Failed to fetch FII/DII data: {e}")
                raise

    def _store_fii_dii_data(self, fii_data, dii_data):
        """Store FII/DII data in the database."""
        date_str = None
        if fii_data and fii_data.get("date"):
            date_str = fii_data.get("date")
        elif dii_data and dii_data.get("date"):
            date_str = dii_data.get("date")

        trade_date = self._parse_trade_date(date_str)
        if not trade_date:
            print("[SCHEDULER] Could not parse trade date, skipping storage")
            return

        db = SessionLocal()
        try:
            # Check if record already exists
            record = (
                db.query(FiiDiiActivity)
                .filter(FiiDiiActivity.trade_date == trade_date)
                .first()
            )

            if record is None:
                record = FiiDiiActivity(trade_date=trade_date)
                db.add(record)
                print(f"[SCHEDULER] Creating new FII/DII record for {trade_date}")
            else:
                print(f"[SCHEDULER] Updating existing FII/DII record for {trade_date}")

            # Update values
            if fii_data:
                record.fii_buy_value = self._parse_numeric(fii_data.get("buyValue"))
                record.fii_sell_value = self._parse_numeric(fii_data.get("sellValue"))
                record.fii_net_value = self._parse_numeric(fii_data.get("netValue"))
            if dii_data:
                record.dii_buy_value = self._parse_numeric(dii_data.get("buyValue"))
                record.dii_sell_value = self._parse_numeric(dii_data.get("sellValue"))
                record.dii_net_value = self._parse_numeric(dii_data.get("netValue"))

            record.source_date_str = date_str
            db.commit()

        except Exception as e:
            print(f"[SCHEDULER] Database error: {e}")
            db.rollback()
        finally:
            db.close()

    def _parse_numeric(self, value):
        """Parse numeric value from various formats."""
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return float(value)
        text = str(value).strip()
        if not text or text == "--":
            return None
        return float(text.replace(",", ""))

    def _parse_trade_date(self, value):
        """Parse trade date from various formats."""
        if not value:
            return None
        text = str(value).strip()
        for fmt in ("%d-%b-%Y", "%d-%b-%Y %H:%M:%S", "%d-%m-%Y", "%Y-%m-%d"):
            try:
                return datetime.strptime(text, fmt).date()
            except ValueError:
                continue
        return None

    def get_status(self) -> dict:
        """Get current scheduler status."""
        return {
            "running": self._running,
            "last_fetch_time": self.last_fetch_time.isoformat() if self.last_fetch_time else None,
            "last_fetch_status": self.last_fetch_status,
            "fetch_interval_seconds": self.fetch_interval_seconds,
        }

    async def force_fetch(self):
        """Manually trigger a data fetch (for API endpoint)."""
        await self._fetch_all_data()
        return self.get_status()


# Global scheduler instance
data_scheduler = DataScheduler()
