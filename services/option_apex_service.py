"""
Option Apex Service - Real-time option candle analysis with OI/Volume tracking.

Features:
- Multi-timeframe candle data (1m, 5m, 15m, 30m)
- Per-candle OI and Volume tracking
- IV (Implied Volatility) change detection
- Institutional flow analysis
- Entry/Exit signal generation
"""
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_
import json

from database.models import (
    OptionApexCandle,
    OptionApexSignal,
    OptionApexIVHistory
)


class OptionApexService:
    """Service for Option Apex real-time candle analysis and signal generation."""

    # Supported timeframes
    TIMEFRAMES = ["1m", "5m", "15m", "30m"]

    def __init__(self, db: Session):
        self.db = db

    # ==================== Candle Data Management ====================

    async def store_candle(
        self,
        symbol: str,
        underlying: str,
        strike: float,
        option_type: str,
        expiry_date: date,
        timeframe: str,
        candle_data: Dict
    ) -> Optional[int]:
        """
        Store a candle with OI/Volume data.

        Args:
            symbol: Option symbol (e.g., NIFTY24JAN24000CE)
            underlying: Underlying asset (NIFTY, BANKNIFTY)
            strike: Strike price
            option_type: CE or PE
            expiry_date: Option expiry date
            timeframe: 1m, 5m, 15m, 30m
            candle_data: Dict with OHLC, volume, OI, IV data
        """
        try:
            # Calculate OI change from previous candle
            prev_candle = self.db.query(OptionApexCandle).filter(
                and_(
                    OptionApexCandle.symbol == symbol,
                    OptionApexCandle.timeframe == timeframe
                )
            ).order_by(desc(OptionApexCandle.candle_time)).first()

            oi_change = None
            oi_change_pct = None
            iv_change = None

            current_oi = candle_data.get("open_interest")
            current_iv = candle_data.get("iv")

            if prev_candle and current_oi is not None:
                if prev_candle.open_interest:
                    oi_change = current_oi - prev_candle.open_interest
                    oi_change_pct = (oi_change / prev_candle.open_interest) * 100

            if prev_candle and current_iv is not None:
                if prev_candle.iv:
                    iv_change = current_iv - prev_candle.iv

            # Calculate net flow
            buyer_qty = candle_data.get("buyer_qty", 0)
            seller_qty = candle_data.get("seller_qty", 0)
            net_flow = buyer_qty - seller_qty

            candle = OptionApexCandle(
                symbol=symbol,
                underlying=underlying,
                strike=strike,
                option_type=option_type,
                expiry_date=expiry_date,
                timeframe=timeframe,
                candle_time=candle_data["candle_time"],
                open_price=candle_data.get("open"),
                high_price=candle_data.get("high"),
                low_price=candle_data.get("low"),
                close_price=candle_data.get("close"),
                volume=candle_data.get("volume"),
                open_interest=current_oi,
                oi_change=oi_change,
                oi_change_pct=oi_change_pct,
                iv=current_iv,
                iv_change=iv_change,
                buyer_qty=buyer_qty,
                seller_qty=seller_qty,
                net_flow=net_flow
            )

            self.db.add(candle)
            self.db.commit()
            self.db.refresh(candle)

            return candle.id

        except Exception as e:
            print(f"Error storing candle: {e}")
            self.db.rollback()
            return None

    def get_candles(
        self,
        symbol: str,
        timeframe: str,
        limit: int = 100
    ) -> List[Dict]:
        """
        Get recent candles for an option.

        Returns candle data formatted for charting libraries.
        """
        try:
            candles = self.db.query(OptionApexCandle).filter(
                and_(
                    OptionApexCandle.symbol == symbol,
                    OptionApexCandle.timeframe == timeframe
                )
            ).order_by(desc(OptionApexCandle.candle_time)).limit(limit).all()

            # Reverse to get chronological order
            candles.reverse()

            return [self._candle_to_dict(c) for c in candles]

        except Exception as e:
            print(f"Error fetching candles: {e}")
            return []

    def _candle_to_dict(self, candle: OptionApexCandle) -> Dict:
        """Convert candle model to dictionary."""
        return {
            "time": candle.candle_time.isoformat() if candle.candle_time else None,
            "open": candle.open_price,
            "high": candle.high_price,
            "low": candle.low_price,
            "close": candle.close_price,
            "volume": candle.volume,
            "oi": candle.open_interest,
            "oi_change": candle.oi_change,
            "oi_change_pct": candle.oi_change_pct,
            "iv": candle.iv,
            "iv_change": candle.iv_change,
            "buyer_qty": candle.buyer_qty,
            "seller_qty": candle.seller_qty,
            "net_flow": candle.net_flow
        }

    # ==================== Institutional Flow Detection ====================

    def detect_institutional_flow(
        self,
        symbol: str,
        timeframe: str,
        lookback_candles: int = 10
    ) -> Dict:
        """
        Detect institutional buying/selling patterns.

        Patterns:
        - OI buildup with positive net flow = Bullish accumulation
        - OI buildup with negative net flow = Bearish accumulation
        - OI unwinding = Position closing

        Returns flow analysis with strength indicator.
        """
        try:
            candles = self.get_candles(symbol, timeframe, limit=lookback_candles)

            if len(candles) < 5:
                return {"flow_type": "INSUFFICIENT_DATA", "strength": 0}

            # Analyze recent candles
            total_oi_change = 0
            total_net_flow = 0
            positive_flow_candles = 0
            negative_flow_candles = 0

            for candle in candles[-lookback_candles:]:
                if candle["oi_change"]:
                    total_oi_change += candle["oi_change"]
                if candle["net_flow"]:
                    total_net_flow += candle["net_flow"]
                    if candle["net_flow"] > 0:
                        positive_flow_candles += 1
                    else:
                        negative_flow_candles += 1

            # Determine flow pattern
            flow_type = "NEUTRAL"
            strength = 0

            if total_oi_change > 0 and total_net_flow > 0:
                flow_type = "BULLISH_ACCUMULATION"
                strength = min(100, (positive_flow_candles / lookback_candles) * 100)
            elif total_oi_change > 0 and total_net_flow < 0:
                flow_type = "BEARISH_ACCUMULATION"
                strength = min(100, (negative_flow_candles / lookback_candles) * 100)
            elif total_oi_change < 0:
                flow_type = "OI_UNWINDING"
                strength = min(100, abs(total_oi_change / lookback_candles))

            return {
                "flow_type": flow_type,
                "strength": round(strength, 2),
                "total_oi_change": total_oi_change,
                "total_net_flow": total_net_flow,
                "candles_analyzed": len(candles)
            }

        except Exception as e:
            print(f"Error detecting institutional flow: {e}")
            return {"flow_type": "ERROR", "strength": 0}

    # ==================== Signal Generation ====================

    async def generate_signal(
        self,
        symbol: str,
        underlying: str,
        strike: float,
        option_type: str,
        expiry_date: date,
        timeframe: str = "5m"
    ) -> Optional[Dict]:
        """
        Generate entry/exit signals based on candle analysis.

        Signal triggers:
        1. OI buildup + Volume spike = Strong entry signal
        2. OI unwinding = Exit signal
        3. IV spike + Volume = Volatility breakout
        4. Net flow reversal = Trend change

        Returns signal with confidence score.
        """
        try:
            # Get recent candles
            candles = self.get_candles(symbol, timeframe, limit=20)

            if len(candles) < 10:
                return None

            # Analyze institutional flow
            flow_analysis = self.detect_institutional_flow(symbol, timeframe, 10)

            # Get latest candle
            latest = candles[-1]

            # Signal generation logic
            signal_type = "HOLD"
            direction = "NEUTRAL"
            strength = "WEAK"
            confidence = 0
            trigger_reason = []

            # Entry signal conditions
            if flow_analysis["flow_type"] == "BULLISH_ACCUMULATION":
                if flow_analysis["strength"] >= 70:
                    signal_type = "ENTRY"
                    direction = "BULLISH"
                    strength = "STRONG"
                    confidence = flow_analysis["strength"]
                    trigger_reason.append("Strong bullish OI buildup")

            elif flow_analysis["flow_type"] == "BEARISH_ACCUMULATION":
                if flow_analysis["strength"] >= 70:
                    signal_type = "ENTRY"
                    direction = "BEARISH"
                    strength = "STRONG"
                    confidence = flow_analysis["strength"]
                    trigger_reason.append("Strong bearish OI buildup")

            # Exit signal conditions
            elif flow_analysis["flow_type"] == "OI_UNWINDING":
                signal_type = "EXIT"
                direction = "NEUTRAL"
                strength = "MODERATE"
                confidence = 60
                trigger_reason.append("OI unwinding detected")

            # Volume spike check
            if latest["volume"] and len(candles) >= 10:
                avg_volume = sum(c["volume"] or 0 for c in candles[-10:-1]) / 9
                if latest["volume"] > avg_volume * 2:
                    trigger_reason.append(f"Volume spike ({latest['volume']/avg_volume:.1f}x avg)")
                    confidence = min(100, confidence + 15)

            # IV spike check
            if latest["iv_change"] and abs(latest["iv_change"]) > 5:
                trigger_reason.append(f"IV change: {latest['iv_change']:.1f}%")
                confidence = min(100, confidence + 10)

            if signal_type == "HOLD":
                return None  # No actionable signal

            # Calculate entry/target/stop levels
            current_price = latest["close"]
            if not current_price:
                return None

            if direction == "BULLISH":
                target_price = current_price * 1.15  # 15% target
                stop_loss = current_price * 0.90     # 10% stop
            elif direction == "BEARISH":
                target_price = current_price * 0.85  # 15% target (for puts)
                stop_loss = current_price * 1.10     # 10% stop
            else:
                target_price = None
                stop_loss = None

            signal = {
                "symbol": symbol,
                "underlying": underlying,
                "strike": strike,
                "option_type": option_type,
                "expiry_date": expiry_date,
                "signal_type": signal_type,
                "direction": direction,
                "strength": strength,
                "confidence_score": round(confidence, 2),
                "trigger_reason": " + ".join(trigger_reason),
                "entry_price": current_price,
                "target_price": target_price,
                "stop_loss": stop_loss,
                "current_price": current_price,
                "oi_at_signal": latest["oi"],
                "volume_at_signal": latest["volume"],
                "iv_at_signal": latest["iv"],
                "signal_time": datetime.now()
            }

            return signal

        except Exception as e:
            print(f"Error generating signal: {e}")
            return None

    async def store_signal(self, signal_data: Dict) -> Optional[int]:
        """Store a generated signal in the database."""
        try:
            signal = OptionApexSignal(
                signal_time=signal_data["signal_time"],
                symbol=signal_data["symbol"],
                underlying=signal_data["underlying"],
                strike=signal_data["strike"],
                option_type=signal_data["option_type"],
                expiry_date=signal_data["expiry_date"],
                signal_type=signal_data["signal_type"],
                direction=signal_data["direction"],
                strength=signal_data["strength"],
                trigger_reason=signal_data["trigger_reason"],
                confidence_score=signal_data["confidence_score"],
                entry_price=signal_data.get("entry_price"),
                target_price=signal_data.get("target_price"),
                stop_loss=signal_data.get("stop_loss"),
                current_price=signal_data.get("current_price"),
                oi_at_signal=signal_data.get("oi_at_signal"),
                volume_at_signal=signal_data.get("volume_at_signal"),
                iv_at_signal=signal_data.get("iv_at_signal"),
                status="ACTIVE"
            )

            self.db.add(signal)
            self.db.commit()
            self.db.refresh(signal)

            return signal.id

        except Exception as e:
            print(f"Error storing signal: {e}")
            self.db.rollback()
            return None

    def get_active_signals(self, underlying: str = None) -> List[Dict]:
        """Get all active signals, optionally filtered by underlying."""
        try:
            query = self.db.query(OptionApexSignal).filter(
                OptionApexSignal.status == "ACTIVE"
            )

            if underlying:
                query = query.filter(OptionApexSignal.underlying == underlying.upper())

            signals = query.order_by(desc(OptionApexSignal.signal_time)).all()

            return [self._signal_to_dict(s) for s in signals]

        except Exception as e:
            print(f"Error fetching active signals: {e}")
            return []

    def _signal_to_dict(self, signal: OptionApexSignal) -> Dict:
        """Convert signal model to dictionary."""
        return {
            "id": signal.id,
            "signal_time": signal.signal_time.isoformat() if signal.signal_time else None,
            "symbol": signal.symbol,
            "underlying": signal.underlying,
            "strike": signal.strike,
            "option_type": signal.option_type,
            "expiry_date": signal.expiry_date.isoformat() if signal.expiry_date else None,
            "signal_type": signal.signal_type,
            "direction": signal.direction,
            "strength": signal.strength,
            "trigger_reason": signal.trigger_reason,
            "confidence_score": signal.confidence_score,
            "entry_price": signal.entry_price,
            "target_price": signal.target_price,
            "stop_loss": signal.stop_loss,
            "current_price": signal.current_price,
            "oi_at_signal": signal.oi_at_signal,
            "volume_at_signal": signal.volume_at_signal,
            "iv_at_signal": signal.iv_at_signal,
            "status": signal.status
        }

    # ==================== IV Tracking ====================

    async def store_iv_snapshot(
        self,
        symbol: str,
        underlying: str,
        strike: float,
        option_type: str,
        expiry_date: date,
        iv_value: float,
        underlying_price: float = None,
        option_price: float = None
    ) -> Optional[int]:
        """Store IV snapshot for historical tracking."""
        try:
            days_to_expiry = (expiry_date - date.today()).days

            # Calculate IV percentile (would need historical data)
            # For now, return None - can be enhanced with historical analysis
            iv_percentile = None

            iv_record = OptionApexIVHistory(
                symbol=symbol,
                underlying=underlying,
                strike=strike,
                option_type=option_type,
                expiry_date=expiry_date,
                snapshot_time=datetime.now(),
                iv_value=iv_value,
                iv_percentile=iv_percentile,
                underlying_price=underlying_price,
                option_price=option_price,
                days_to_expiry=days_to_expiry
            )

            self.db.add(iv_record)
            self.db.commit()
            self.db.refresh(iv_record)

            return iv_record.id

        except Exception as e:
            print(f"Error storing IV snapshot: {e}")
            self.db.rollback()
            return None

    def get_iv_history(
        self,
        symbol: str,
        days: int = 7
    ) -> List[Dict]:
        """Get IV history for an option."""
        try:
            since = datetime.now() - timedelta(days=days)

            iv_records = self.db.query(OptionApexIVHistory).filter(
                and_(
                    OptionApexIVHistory.symbol == symbol,
                    OptionApexIVHistory.snapshot_time >= since
                )
            ).order_by(OptionApexIVHistory.snapshot_time).all()

            return [{
                "time": r.snapshot_time.isoformat(),
                "iv": r.iv_value,
                "iv_percentile": r.iv_percentile,
                "underlying_price": r.underlying_price,
                "option_price": r.option_price,
                "days_to_expiry": r.days_to_expiry
            } for r in iv_records]

        except Exception as e:
            print(f"Error fetching IV history: {e}")
            return []

    # ==================== Chart Data Formatting ====================

    def format_for_lightweight_charts(
        self,
        candles: List[Dict]
    ) -> Dict:
        """
        Format candle data for lightweight-charts library.

        Returns separate series for:
        - Price (candlestick)
        - Volume (histogram)
        - OI (line)
        - IV (line)
        """
        price_data = []
        volume_data = []
        oi_data = []
        iv_data = []

        for candle in candles:
            timestamp = candle["time"]

            # Price series (candlestick)
            if all(candle.get(k) for k in ["open", "high", "low", "close"]):
                price_data.append({
                    "time": timestamp,
                    "open": candle["open"],
                    "high": candle["high"],
                    "low": candle["low"],
                    "close": candle["close"]
                })

            # Volume series (histogram)
            if candle.get("volume"):
                volume_data.append({
                    "time": timestamp,
                    "value": candle["volume"],
                    "color": "#26a69a" if candle["close"] >= candle["open"] else "#ef5350"
                })

            # OI series (line)
            if candle.get("oi"):
                oi_data.append({
                    "time": timestamp,
                    "value": candle["oi"]
                })

            # IV series (line)
            if candle.get("iv"):
                iv_data.append({
                    "time": timestamp,
                    "value": candle["iv"]
                })

        return {
            "price": price_data,
            "volume": volume_data,
            "oi": oi_data,
            "iv": iv_data
        }
