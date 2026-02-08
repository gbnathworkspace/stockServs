"""
Option Clock Service
Fetches option chain data from Fyers and calculates OI-based market signals.
"""

from fyers_apiv3 import fyersModel
from datetime import datetime, date, timedelta
from typing import Optional, Dict, List, Tuple
import os
import json
from dotenv import load_dotenv

from database.connection import SessionLocal
from database.models import OptionClockSnapshot, OptionClockDailySummary, FyersToken

load_dotenv()

FYERS_CLIENT_ID = os.getenv("FYERS_CLIENT_ID")


class OptionClockService:
    """
    Service for fetching and analyzing option chain data for the Option Clock feature.
    """

    # Index symbols and their Fyers symbol format
    SUPPORTED_INDICES = {
        "NIFTY": "NSE:NIFTY50-INDEX",
        "BANKNIFTY": "NSE:NIFTYBANK-INDEX",
        "FINNIFTY": "NSE:FINNIFTY-INDEX",
        "MIDCPNIFTY": "NSE:MIDCPNIFTY-INDEX",
    }

    # Stock symbols for F&O (use EQ segment for spot price)
    SUPPORTED_STOCKS = {
        "RELIANCE": "NSE:RELIANCE-EQ",
        "HDFCBANK": "NSE:HDFCBANK-EQ",
        "INFY": "NSE:INFY-EQ",
        "TCS": "NSE:TCS-EQ",
    }

    # Strike step sizes per symbol
    STRIKE_STEPS = {
        "NIFTY": 50,
        "BANKNIFTY": 100,
        "FINNIFTY": 50,
        "MIDCPNIFTY": 25,
        "RELIANCE": 20,
        "HDFCBANK": 20,
        "INFY": 20,
        "TCS": 50,
    }

    # Option symbol format: NSE:NIFTY24DEC24000CE, NSE:NIFTY24DEC24000PE
    # Format: NSE:<INDEX><YY><MONTH><STRIKE><CE/PE>

    MONTH_MAP = {
        1: "JAN", 2: "FEB", 3: "MAR", 4: "APR", 5: "MAY", 6: "JUN",
        7: "JUL", 8: "AUG", 9: "SEP", 10: "OCT", 11: "NOV", 12: "DEC"
    }

    # NSE weekly option month codes: 1-9 for Jan-Sep, O/N/D for Oct/Nov/Dec
    WEEKLY_MONTH_CODES = {
        1: "1", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6",
        7: "7", 8: "8", 9: "9", 10: "O", 11: "N", 12: "D"
    }

    def __init__(self):
        self.last_snapshots: Dict[str, OptionClockSnapshot] = {}

    def get_fyers_client(self, access_token: str) -> fyersModel.FyersModel:
        """Get an authenticated Fyers client."""
        return fyersModel.FyersModel(
            client_id=FYERS_CLIENT_ID,
            token=access_token,
            is_async=False,
            log_path=os.getcwd()
        )

    def get_system_access_token(self) -> Optional[str]:
        """
        Get a valid Fyers access token from the database.
        Uses the most recently created token.
        Auto-refreshes expired tokens using refresh_token if available.
        """
        from services.fyers_service import refresh_fyers_access_token

        db = SessionLocal()
        try:
            token_record = (
                db.query(FyersToken)
                .order_by(FyersToken.created_at.desc())
                .first()
            )
            if not token_record or not token_record.access_token:
                return None

            # Token is valid
            if not token_record.expires_at or token_record.expires_at > datetime.now():
                return token_record.access_token

            # Token expired — try auto-refresh
            if token_record.refresh_token:
                print("[SYSTEM_TOKEN] Token expired, attempting refresh...")
                refresh_result = refresh_fyers_access_token(token_record.refresh_token)
                if refresh_result and refresh_result.get("s") == "ok":
                    new_access = refresh_result.get("access_token")
                    new_refresh = refresh_result.get("refresh_token")
                    if new_access:
                        token_record.access_token = new_access
                        if new_refresh:
                            token_record.refresh_token = new_refresh
                        token_record.created_at = datetime.utcnow()
                        token_record.expires_at = datetime.utcnow() + timedelta(days=1)
                        db.commit()
                        print(f"[SYSTEM_TOKEN] Token refreshed successfully")
                        return new_access
                print("[SYSTEM_TOKEN] Refresh failed")
            else:
                print("[SYSTEM_TOKEN] Token expired, no refresh_token available")
            return None
        finally:
            db.close()

    def get_nearest_expiry(self, symbol: str = "NIFTY") -> date:
        """
        Get the nearest Thursday expiry for the given index.
        NIFTY expires on Thursday, BANKNIFTY also on Thursday (changed from Wednesday).
        """
        today = date.today()
        days_until_thursday = (3 - today.weekday()) % 7
        if days_until_thursday == 0 and datetime.now().hour >= 15:
            # If it's Thursday after 3 PM, next expiry is next Thursday
            days_until_thursday = 7
        next_thursday = today + timedelta(days=days_until_thursday)
        return next_thursday

    def get_upcoming_expiries(self, symbol: str = "NIFTY", count: int = 5) -> List[date]:
        """
        Get the next N upcoming Thursday expiry dates.
        Skips the current Thursday if market has closed (after 3:30 PM).
        """
        today = date.today()
        now = datetime.now()
        expiries = []

        # Start from today and find upcoming Thursdays
        days_until_thursday = (3 - today.weekday()) % 7
        if days_until_thursday == 0 and now.hour >= 15:
            # If it's Thursday after 3 PM, skip to next Thursday
            days_until_thursday = 7
        next_thursday = today + timedelta(days=days_until_thursday)

        while len(expiries) < count:
            expiries.append(next_thursday)
            next_thursday += timedelta(days=7)

        return expiries

    def get_atm_strike(self, spot_price: float, step: int = 50) -> float:
        """Get the at-the-money strike based on spot price."""
        return round(spot_price / step) * step

    def generate_strikes(self, atm_strike: float, step: int = 50, count: int = 20) -> List[float]:
        """Generate strike prices around ATM (count strikes on each side)."""
        strikes = []
        for i in range(-count, count + 1):
            strikes.append(atm_strike + (i * step))
        return strikes

    def _is_monthly_expiry(self, expiry_date: date) -> bool:
        """Check if the given date is the last Thursday of its month."""
        # Find the last day of the month
        if expiry_date.month == 12:
            next_month = date(expiry_date.year + 1, 1, 1)
        else:
            next_month = date(expiry_date.year, expiry_date.month + 1, 1)
        last_day = next_month - timedelta(days=1)

        # Find the last Thursday (weekday 3)
        days_since_thursday = (last_day.weekday() - 3) % 7
        last_thursday = last_day - timedelta(days=days_since_thursday)

        return expiry_date == last_thursday

    def format_option_symbol(self, index: str, expiry: date, strike: float, option_type: str) -> str:
        """
        Format the Fyers option symbol.
        Monthly expiry: NSE:NIFTY26FEB25000CE (YY + full month + strike + type)
        Weekly expiry:  NSE:NIFTY2621225000CE (YY + month_code + day(2-digit) + strike + type)

        Weekly month codes: 1-9 for Jan-Sep, O/N/D for Oct/Nov/Dec
        """
        year = str(expiry.year)[-2:]  # Last 2 digits
        strike_str = str(int(strike))

        if self._is_monthly_expiry(expiry):
            # Monthly format: NSE:NIFTY26FEB25000CE
            month = self.MONTH_MAP[expiry.month]
            symbol = f"NSE:{index}{year}{month}{strike_str}{option_type}"
        else:
            # Weekly format: NSE:NIFTY2621225000CE
            month_code = self.WEEKLY_MONTH_CODES[expiry.month]
            day = str(expiry.day).zfill(2)
            symbol = f"NSE:{index}{year}{month_code}{day}{strike_str}{option_type}"

        return symbol

    def fetch_option_chain(self, access_token: str, symbol: str = "NIFTY") -> Optional[Dict]:
        """
        Fetch option chain data from Fyers for the given index or stock.
        Returns aggregated OI data with LTP, volume, and change for calls and puts.
        """
        try:
            fyers = self.get_fyers_client(access_token)

            # Get the spot/underlying symbol
            spot_symbol = self.SUPPORTED_INDICES.get(symbol) or self.SUPPORTED_STOCKS.get(symbol)
            if not spot_symbol:
                print(f"[OPTION_CLOCK] Unsupported symbol: {symbol}")
                return None

            # Fetch spot price using quotes API
            quotes_data = {"symbols": spot_symbol}
            quotes_response = fyers.quotes(quotes_data)

            if quotes_response.get("s") != "ok":
                print(f"[OPTION_CLOCK] Failed to fetch spot price: {quotes_response}")
                return None

            spot_data = quotes_response.get("d", [{}])[0].get("v", {})
            # Fall back to prev_close_price or close_price when lp is 0 (market closed)
            spot_price = spot_data.get("lp", 0) or spot_data.get("prev_close_price", 0) or spot_data.get("close_price", 0)
            prev_close = spot_data.get("prev_close_price", spot_price)

            if spot_price == 0:
                print(f"[OPTION_CLOCK] No price data available for {symbol}")
                return None

            # Calculate ATM strike and generate strikes to fetch
            step = self.STRIKE_STEPS.get(symbol, 50)
            atm_strike = self.get_atm_strike(spot_price, step)
            strikes = self.generate_strikes(atm_strike, step, count=15)

            expiry = self.get_nearest_expiry(symbol)

            # Fetch option quotes for all strikes
            # Fyers supports batch quotes, up to 50 symbols at once
            option_symbols = []
            symbol_strike_map = {}  # Map Fyers symbol -> (strike, option_type)
            for strike in strikes:
                ce_symbol = self.format_option_symbol(symbol, expiry, strike, "CE")
                pe_symbol = self.format_option_symbol(symbol, expiry, strike, "PE")
                option_symbols.extend([ce_symbol, pe_symbol])
                symbol_strike_map[ce_symbol] = (strike, "CE")
                symbol_strike_map[pe_symbol] = (strike, "PE")

            print(f"[OPTION_CLOCK] Fetching {len(option_symbols)} option symbols for {symbol} expiry {expiry}")
            if option_symbols:
                print(f"[OPTION_CLOCK] Sample symbols: {option_symbols[0]}, {option_symbols[1]}")

            # Fetch in batches if needed
            all_option_data = []
            batch_size = 50
            for i in range(0, len(option_symbols), batch_size):
                batch = option_symbols[i:i + batch_size]
                batch_data = {"symbols": ",".join(batch)}
                batch_response = fyers.quotes(batch_data)

                if batch_response.get("s") == "ok":
                    all_option_data.extend(batch_response.get("d", []))
                else:
                    print(f"[OPTION_CLOCK] Batch {i//batch_size + 1} quote failed: {batch_response.get('s')} - {batch_response.get('message', 'unknown')}")

            # Get upcoming expiry dates
            upcoming_expiries = self.get_upcoming_expiries(symbol, count=5)

            if not all_option_data:
                print(f"[OPTION_CLOCK] WARNING: No option quotes returned for {symbol} expiry {expiry}. Returning None to trigger fallback.")
                return None

            # Process option data
            result = self._process_option_data(
                all_option_data, spot_price, prev_close, symbol, expiry, strikes,
                symbol_strike_map
            )
            if result:
                result["upcoming_expiries"] = upcoming_expiries
            return result

        except Exception as e:
            print(f"[OPTION_CLOCK] Error fetching option chain: {e}")
            import traceback
            traceback.print_exc()
            return None

    def _process_option_data(
        self,
        option_data: List[Dict],
        spot_price: float,
        prev_close: float,
        symbol: str,
        expiry: date,
        strikes: List[float],
        symbol_strike_map: Dict[str, tuple] = None
    ) -> Dict:
        """Process raw option data into aggregated metrics with full price data."""

        total_call_oi = 0
        total_put_oi = 0
        strike_breakdown = {}
        highest_call_oi = {"strike": 0, "oi": 0}
        highest_put_oi = {"strike": 0, "oi": 0}

        for item in option_data:
            v = item.get("v", {})
            sym = item.get("n", "")

            # Look up strike and type from pre-built mapping
            try:
                if symbol_strike_map and sym in symbol_strike_map:
                    strike, option_type = symbol_strike_map[sym]
                else:
                    # Fallback: skip unknown symbols
                    continue
                oi = v.get("oi", 0) or v.get("open_interest", 0) or 0
                pdoi = v.get("pdoi", 0) or 0
                oi_change = oi - pdoi
                ltp = v.get("lp", 0) or v.get("prev_close_price", 0) or 0
                volume = v.get("vol_traded_today", 0) or v.get("volume", 0) or 0
                change = v.get("ch", 0) or 0
                pChange = v.get("chp", 0) or 0

                if strike not in strike_breakdown:
                    strike_breakdown[strike] = {
                        "call_oi": 0, "put_oi": 0,
                        "call_oi_change": 0, "put_oi_change": 0,
                        "call_ltp": 0, "put_ltp": 0,
                        "call_volume": 0, "put_volume": 0,
                        "call_change": 0, "put_change": 0,
                        "call_pChange": 0, "put_pChange": 0,
                        "call_identifier": "", "put_identifier": "",
                    }

                if option_type == "CE":
                    total_call_oi += oi
                    strike_breakdown[strike]["call_oi"] = oi
                    strike_breakdown[strike]["call_oi_change"] = oi_change
                    strike_breakdown[strike]["call_ltp"] = ltp
                    strike_breakdown[strike]["call_volume"] = volume
                    strike_breakdown[strike]["call_change"] = change
                    strike_breakdown[strike]["call_pChange"] = pChange
                    strike_breakdown[strike]["call_identifier"] = sym
                    if oi > highest_call_oi["oi"]:
                        highest_call_oi = {"strike": strike, "oi": oi}
                else:
                    total_put_oi += oi
                    strike_breakdown[strike]["put_oi"] = oi
                    strike_breakdown[strike]["put_oi_change"] = oi_change
                    strike_breakdown[strike]["put_ltp"] = ltp
                    strike_breakdown[strike]["put_volume"] = volume
                    strike_breakdown[strike]["put_change"] = change
                    strike_breakdown[strike]["put_pChange"] = pChange
                    strike_breakdown[strike]["put_identifier"] = sym
                    if oi > highest_put_oi["oi"]:
                        highest_put_oi = {"strike": strike, "oi": oi}

            except (ValueError, IndexError) as e:
                continue

        # Calculate PCR
        pcr = total_put_oi / total_call_oi if total_call_oi > 0 else 0

        # Calculate Max Pain (strike where total premium paid is minimum)
        max_pain_strike = self._calculate_max_pain(strike_breakdown, strikes)

        return {
            "symbol": symbol,
            "expiry": expiry,
            "timestamp": datetime.now(),
            "spot_price": spot_price,
            "prev_close": prev_close,
            "price_change": spot_price - prev_close,
            "price_change_pct": ((spot_price - prev_close) / prev_close * 100) if prev_close else 0,
            "total_call_oi": total_call_oi,
            "total_put_oi": total_put_oi,
            "pcr": round(pcr, 3),
            "max_pain_strike": max_pain_strike,
            "highest_call_oi_strike": highest_call_oi["strike"],
            "highest_put_oi_strike": highest_put_oi["strike"],
            "strike_breakdown": strike_breakdown
        }

    def _calculate_max_pain(self, strike_breakdown: Dict, strikes: List[float]) -> float:
        """
        Calculate Max Pain - the strike at which total option premium paid is minimum.
        This is where most options expire worthless.
        """
        min_pain = float('inf')
        max_pain_strike = strikes[len(strikes) // 2] if strikes else 0

        for strike in strikes:
            total_pain = 0

            for s, data in strike_breakdown.items():
                call_oi = data.get("call_oi", 0)
                put_oi = data.get("put_oi", 0)

                # Call pain: max(0, strike_price - expiry_price) * call_oi
                if strike > s:
                    total_pain += (strike - s) * call_oi

                # Put pain: max(0, expiry_price - strike_price) * put_oi
                if strike < s:
                    total_pain += (s - strike) * put_oi

            if total_pain < min_pain:
                min_pain = total_pain
                max_pain_strike = strike

        return max_pain_strike

    def determine_signal(
        self,
        current: Dict,
        previous: Optional[OptionClockSnapshot]
    ) -> Tuple[str, str]:
        """
        Determine the market signal based on OI and price changes.

        Signals:
        - LONG_BUILDUP: Price ↑ + OI ↑ (Bullish)
        - SHORT_COVERING: Price ↑ + OI ↓ (Bullish, but weak)
        - SHORT_BUILDUP: Price ↓ + OI ↑ (Bearish)
        - LONG_UNWINDING: Price ↓ + OI ↓ (Bearish, but weak)

        Signal Strength based on PCR:
        - PCR > 1.2: Put heavy (Bullish bias)
        - PCR < 0.8: Call heavy (Bearish bias)
        - 0.8-1.2: Neutral range
        """
        price_change = current.get("price_change", 0)
        pcr = current.get("pcr", 1)

        # Calculate OI change from previous snapshot if available
        if previous:
            call_oi_change = current["total_call_oi"] - (previous.total_call_oi or 0)
            put_oi_change = current["total_put_oi"] - (previous.total_put_oi or 0)
            total_oi_change = call_oi_change + put_oi_change
        else:
            total_oi_change = 0

        # Determine signal
        price_up = price_change > 0
        oi_up = total_oi_change > 0

        if price_up and oi_up:
            signal = "LONG_BUILDUP"
        elif price_up and not oi_up:
            signal = "SHORT_COVERING"
        elif not price_up and oi_up:
            signal = "SHORT_BUILDUP"
        else:
            signal = "LONG_UNWINDING"

        # Determine strength
        if pcr > 1.5 or pcr < 0.6:
            strength = "STRONG"
        elif pcr > 1.2 or pcr < 0.8:
            strength = "MODERATE"
        else:
            strength = "WEAK"

        return signal, strength

    def create_snapshot(self, access_token: str, symbol: str = "NIFTY") -> Optional[OptionClockSnapshot]:
        """
        Fetch option chain data and create a snapshot record.
        """
        data = self.fetch_option_chain(access_token, symbol)
        if not data:
            return None

        # Get previous snapshot for comparison
        db = SessionLocal()
        try:
            previous = (
                db.query(OptionClockSnapshot)
                .filter(OptionClockSnapshot.symbol == symbol)
                .order_by(OptionClockSnapshot.timestamp.desc())
                .first()
            )

            # Calculate changes from previous
            call_oi_change = 0
            put_oi_change = 0
            pcr_change = 0

            if previous:
                call_oi_change = data["total_call_oi"] - (previous.total_call_oi or 0)
                put_oi_change = data["total_put_oi"] - (previous.total_put_oi or 0)
                pcr_change = data["pcr"] - (previous.pcr or 0)

            # Determine signal
            signal, strength = self.determine_signal(data, previous)

            # Create snapshot
            snapshot = OptionClockSnapshot(
                timestamp=data["timestamp"],
                symbol=symbol,
                expiry_date=data["expiry"],
                total_call_oi=data["total_call_oi"],
                total_put_oi=data["total_put_oi"],
                call_oi_change=call_oi_change,
                put_oi_change=put_oi_change,
                pcr=data["pcr"],
                pcr_change=pcr_change,
                spot_price=data["spot_price"],
                price_change=data["price_change"],
                price_change_pct=data["price_change_pct"],
                signal=signal,
                signal_strength=strength,
                strike_data=json.dumps(data["strike_breakdown"]),
                max_pain_strike=data["max_pain_strike"],
                highest_call_oi_strike=data["highest_call_oi_strike"],
                highest_put_oi_strike=data["highest_put_oi_strike"]
            )

            db.add(snapshot)
            db.commit()
            db.refresh(snapshot)

            print(f"[OPTION_CLOCK] Created snapshot for {symbol}: PCR={data['pcr']}, Signal={signal}")
            return snapshot

        except Exception as e:
            print(f"[OPTION_CLOCK] Error creating snapshot: {e}")
            db.rollback()
            return None
        finally:
            db.close()

    def cleanup_old_snapshots(self, days_to_keep: int = 7):
        """
        Remove intraday snapshots older than specified days.
        Daily summaries are kept indefinitely.
        """
        db = SessionLocal()
        try:
            cutoff_date = datetime.now() - timedelta(days=days_to_keep)

            deleted = (
                db.query(OptionClockSnapshot)
                .filter(OptionClockSnapshot.timestamp < cutoff_date)
                .delete()
            )

            db.commit()
            print(f"[OPTION_CLOCK] Cleaned up {deleted} old snapshots")

        except Exception as e:
            print(f"[OPTION_CLOCK] Cleanup error: {e}")
            db.rollback()
        finally:
            db.close()

    def create_daily_summary(self, symbol: str, trade_date: date):
        """
        Create a daily summary from intraday snapshots.
        Called at market close.
        """
        db = SessionLocal()
        try:
            # Get all snapshots for the day
            snapshots = (
                db.query(OptionClockSnapshot)
                .filter(
                    OptionClockSnapshot.symbol == symbol,
                    OptionClockSnapshot.timestamp >= datetime.combine(trade_date, datetime.min.time()),
                    OptionClockSnapshot.timestamp < datetime.combine(trade_date + timedelta(days=1), datetime.min.time())
                )
                .order_by(OptionClockSnapshot.timestamp)
                .all()
            )

            if not snapshots:
                print(f"[OPTION_CLOCK] No snapshots found for {symbol} on {trade_date}")
                return None

            opening = snapshots[0]
            closing = snapshots[-1]

            # Count signals to determine dominant signal
            signal_counts = {}
            for s in snapshots:
                if s.signal:
                    signal_counts[s.signal] = signal_counts.get(s.signal, 0) + 1

            dominant_signal = max(signal_counts, key=signal_counts.get) if signal_counts else None

            # Create or update daily summary
            summary = (
                db.query(OptionClockDailySummary)
                .filter(
                    OptionClockDailySummary.trade_date == trade_date,
                    OptionClockDailySummary.symbol == symbol
                )
                .first()
            )

            if not summary:
                summary = OptionClockDailySummary(
                    trade_date=trade_date,
                    symbol=symbol,
                    expiry_date=closing.expiry_date
                )
                db.add(summary)

            # Update values
            summary.opening_call_oi = opening.total_call_oi
            summary.opening_put_oi = opening.total_put_oi
            summary.opening_pcr = opening.pcr
            summary.opening_spot = opening.spot_price

            summary.closing_call_oi = closing.total_call_oi
            summary.closing_put_oi = closing.total_put_oi
            summary.closing_pcr = closing.pcr
            summary.closing_spot = closing.spot_price

            summary.call_oi_day_change = (closing.total_call_oi or 0) - (opening.total_call_oi or 0)
            summary.put_oi_day_change = (closing.total_put_oi or 0) - (opening.total_put_oi or 0)
            summary.pcr_day_change = (closing.pcr or 0) - (opening.pcr or 0)
            summary.spot_day_change = (closing.spot_price or 0) - (opening.spot_price or 0)

            if opening.spot_price:
                summary.spot_day_change_pct = (summary.spot_day_change / opening.spot_price) * 100

            summary.max_pain_strike = closing.max_pain_strike
            summary.highest_call_oi_strike = closing.highest_call_oi_strike
            summary.highest_put_oi_strike = closing.highest_put_oi_strike
            summary.dominant_signal = dominant_signal

            db.commit()
            print(f"[OPTION_CLOCK] Created daily summary for {symbol} on {trade_date}")
            return summary

        except Exception as e:
            print(f"[OPTION_CLOCK] Error creating daily summary: {e}")
            db.rollback()
            return None
        finally:
            db.close()

    def get_latest_snapshot(self, symbol: str = "NIFTY") -> Optional[Dict]:
        """Get the most recent snapshot for display."""
        db = SessionLocal()
        try:
            snapshot = (
                db.query(OptionClockSnapshot)
                .filter(OptionClockSnapshot.symbol == symbol)
                .order_by(OptionClockSnapshot.timestamp.desc())
                .first()
            )

            if not snapshot:
                return None

            return {
                "id": snapshot.id,
                "timestamp": snapshot.timestamp.isoformat(),
                "symbol": snapshot.symbol,
                "expiry_date": snapshot.expiry_date.isoformat(),
                "total_call_oi": snapshot.total_call_oi,
                "total_put_oi": snapshot.total_put_oi,
                "call_oi_change": snapshot.call_oi_change,
                "put_oi_change": snapshot.put_oi_change,
                "pcr": snapshot.pcr,
                "pcr_change": snapshot.pcr_change,
                "spot_price": snapshot.spot_price,
                "price_change": snapshot.price_change,
                "price_change_pct": snapshot.price_change_pct,
                "signal": snapshot.signal,
                "signal_strength": snapshot.signal_strength,
                "max_pain_strike": snapshot.max_pain_strike,
                "highest_call_oi_strike": snapshot.highest_call_oi_strike,
                "highest_put_oi_strike": snapshot.highest_put_oi_strike,
                "strike_data": json.loads(snapshot.strike_data) if snapshot.strike_data else None
            }
        finally:
            db.close()

    def get_intraday_snapshots(self, symbol: str = "NIFTY", trade_date: date = None) -> List[Dict]:
        """Get all snapshots for a given day."""
        if trade_date is None:
            trade_date = date.today()

        db = SessionLocal()
        try:
            snapshots = (
                db.query(OptionClockSnapshot)
                .filter(
                    OptionClockSnapshot.symbol == symbol,
                    OptionClockSnapshot.timestamp >= datetime.combine(trade_date, datetime.min.time()),
                    OptionClockSnapshot.timestamp < datetime.combine(trade_date + timedelta(days=1), datetime.min.time())
                )
                .order_by(OptionClockSnapshot.timestamp)
                .all()
            )

            return [
                {
                    "timestamp": s.timestamp.isoformat(),
                    "pcr": s.pcr,
                    "spot_price": s.spot_price,
                    "signal": s.signal,
                    "call_oi_change": s.call_oi_change,
                    "put_oi_change": s.put_oi_change
                }
                for s in snapshots
            ]
        finally:
            db.close()


# Global service instance
option_clock_service = OptionClockService()
