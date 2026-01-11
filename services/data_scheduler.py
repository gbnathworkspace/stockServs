"""
Background Data Scheduler Service
Automatically fetches and stores market data (FII/DII, Option Clock, etc.) without requiring user visits.
"""

import asyncio
import httpx
from datetime import datetime, time as dt_time, date
from typing import Optional
import threading

from database.connection import SessionLocal
from database.models import FiiDiiActivity


# NSE API URLs
NSE_FII_DII_URL = "https://www.nseindia.com/api/fiidiiTradeReact"

# Option Clock fetch interval (15 minutes = 900 seconds)
OPTION_CLOCK_INTERVAL = 900

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
        self.fetch_interval_seconds = 3600  # Fetch FII/DII every hour
        self.option_clock_interval = OPTION_CLOCK_INTERVAL  # Fetch Option Clock every 15 min
        self.market_pulse_interval = 1800  # Fetch Market Pulse every 30 min
        self.last_fetch_time: Optional[datetime] = None
        self.last_fetch_status: str = "Not started"
        self.last_option_clock_fetch: Optional[datetime] = None
        self.option_clock_status: str = "Not started"
        self.last_market_pulse_fetch: Optional[datetime] = None
        self.market_pulse_status: str = "Not started"
        self.last_fyers_sync: Optional[datetime] = None
        self.fyers_sync_status: str = "Not started"

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

        # Track last fetch times separately
        last_oc_check = datetime.now()
        last_mp_check = datetime.now()

        while self._running:
            try:
                # Check every minute for periodic tasks
                await asyncio.sleep(60)

                now = datetime.now()

                # Only operate during market hours (9 AM - 6 PM IST) on weekdays
                if not self._is_market_time(now):
                    print(f"[SCHEDULER] Outside market hours ({now.strftime('%H:%M')})")
                    continue

                # Option Clock: Fetch every 15 minutes during market hours
                time_since_oc = (now - last_oc_check).total_seconds()
                if time_since_oc >= self.option_clock_interval:
                    await self._fetch_option_clock_data()
                    last_oc_check = now

                # Market Pulse: Fetch every 30 minutes during market hours
                time_since_mp = (now - last_mp_check).total_seconds()
                if time_since_mp >= self.market_pulse_interval:
                    await self._fetch_market_pulse_data()
                    last_mp_check = now

                # Fyers Symbol Sync: Once every 24 hours
                if not self.last_fyers_sync or (now - self.last_fyers_sync).total_seconds() >= 86400:
                    await self._sync_fyers_symbols()
                    self.last_fyers_sync = now

                # FII/DII: Fetch every hour
                if self.last_fetch_time:
                    time_since_fii = (now - self.last_fetch_time).total_seconds()
                    if time_since_fii >= self.fetch_interval_seconds:
                        await self._fetch_fii_dii_data()
                        self.last_fetch_time = now
                        self.last_fetch_status = "Success"

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
            print(f"[SCHEDULER] FII/DII data fetch completed successfully")

        except Exception as e:
            self.last_fetch_status = f"Error: {str(e)}"
            print(f"[SCHEDULER] FII/DII data fetch failed: {e}")

        # Also fetch Option Clock data on startup if during market hours
        try:
            if self._is_market_time(datetime.now()):
                await self._fetch_option_clock_data()
        except Exception as e:
            print(f"[SCHEDULER] Option Clock fetch failed on startup: {e}")

    async def _fetch_option_clock_data(self):
        """Fetch and store Option Clock OI snapshots for NIFTY and BANKNIFTY."""
        from services.option_clock_service import option_clock_service

        try:
            # Get system access token
            access_token = option_clock_service.get_system_access_token()
            if not access_token:
                print("[SCHEDULER] No Fyers access token available for Option Clock")
                self.option_clock_status = "No token"
                return

            # Fetch snapshots for both indices
            for symbol in ["NIFTY", "BANKNIFTY"]:
                try:
                    snapshot = option_clock_service.create_snapshot(access_token, symbol)
                    if snapshot:
                        print(f"[SCHEDULER] Option Clock snapshot created for {symbol}")
                    else:
                        print(f"[SCHEDULER] Failed to create Option Clock snapshot for {symbol}")
                except Exception as e:
                    print(f"[SCHEDULER] Error fetching {symbol} option data: {e}")

            self.last_option_clock_fetch = datetime.now()
            self.option_clock_status = "Success"

            # At market close (after 3:30 PM), create daily summary
            now = datetime.now()
            if now.hour == 15 and now.minute >= 30:
                self._create_daily_summaries()

            # Run cleanup once per day (after market close)
            if now.hour == 18 and now.minute < 15:  # Run cleanup around 6 PM
                self._run_option_clock_cleanup()

        except Exception as e:
            print(f"[SCHEDULER] Option Clock fetch failed: {e}")
            self.option_clock_status = f"Error: {str(e)}"

    def _create_daily_summaries(self):
        """Create daily summaries at market close."""
        from services.option_clock_service import option_clock_service

        today = date.today()
        for symbol in ["NIFTY", "BANKNIFTY"]:
            try:
                option_clock_service.create_daily_summary(symbol, today)
            except Exception as e:
                print(f"[SCHEDULER] Failed to create daily summary for {symbol}: {e}")

    def _run_option_clock_cleanup(self):
        """Clean up old Option Clock snapshots (keep 7 days)."""
        from services.option_clock_service import option_clock_service

        try:
            option_clock_service.cleanup_old_snapshots(days_to_keep=7)
        except Exception as e:
            print(f"[SCHEDULER] Option Clock cleanup failed: {e}")

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

    async def _fetch_market_pulse_data(self):
        """Fetch and store Market Pulse data (bulk deals, snapshots)."""
        from services.market_pulse_service import MarketPulseService

        db = SessionLocal()
        try:
            service = MarketPulseService(db)

            # Fetch and store bulk/block deals
            await service.fetch_and_store_bulk_deals()

            # Generate snapshot
            await service.generate_snapshot()

            self.last_market_pulse_fetch = datetime.now()
            self.market_pulse_status = "Success"
            print("[SCHEDULER] Market Pulse data fetched successfully")

            # At market close (after 3:30 PM), create daily summary
            now = datetime.now()
            if now.hour == 15 and now.minute >= 30:
                await service.generate_daily_summary()
                print("[SCHEDULER] Market Pulse daily summary generated")

            # Update volume baselines after market close (around 6 PM)
            if now.hour == 18 and now.minute < 30:
                await service.update_volume_baselines()
                print("[SCHEDULER] Volume baselines updated")

        except Exception as e:
            print(f"[SCHEDULER] Market Pulse fetch failed: {e}")
            self.market_pulse_status = f"Error: {str(e)}"
        finally:
            db.close()

    async def _sync_fyers_symbols(self):
        """Download latest symbol master from Fyers."""
        from services.fyers_service import download_fyers_master
        try:
            success = await download_fyers_master()
            self.fyers_sync_status = "Success" if success else "Failed"
            print(f"[SCHEDULER] Fyers symbol sync: {self.fyers_sync_status}")
        except Exception as e:
            print(f"[SCHEDULER] Fyers symbol sync error: {e}")
            self.fyers_sync_status = f"Error: {str(e)}"

    def get_status(self) -> dict:
        """Get current scheduler status."""
        return {
            "running": self._running,
            "fii_dii": {
                "last_fetch_time": self.last_fetch_time.isoformat() if self.last_fetch_time else None,
                "status": self.last_fetch_status,
                "interval_seconds": self.fetch_interval_seconds,
            },
            "option_clock": {
                "last_fetch_time": self.last_option_clock_fetch.isoformat() if self.last_option_clock_fetch else None,
                "status": self.option_clock_status,
                "interval_seconds": self.option_clock_interval,
            },
            "market_pulse": {
                "last_fetch_time": self.last_market_pulse_fetch.isoformat() if self.last_market_pulse_fetch else None,
                "status": self.market_pulse_status,
                "interval_seconds": self.market_pulse_interval,
            }
        }

    async def force_fetch(self):
        """Manually trigger a data fetch (for API endpoint)."""
        await self._fetch_all_data()
        return self.get_status()


# Global scheduler instance
data_scheduler = DataScheduler()
