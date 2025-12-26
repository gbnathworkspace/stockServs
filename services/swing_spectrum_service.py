"""
Swing Spectrum Service - Medium-term swing trade opportunities.

Features:
- 52-week breakout detection
- Breakout strength analysis
- Volume confirmation
- Swing trade opportunity scoring
"""
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import desc
import json

from database.models import SwingSpectrumBreakout, SwingSpectrumDailySummary
from nse_data.high_low import fetch_52week_data


class SwingSpectrumService:
    """Service for Swing Spectrum breakout detection and analysis."""

    def __init__(self, db: Session):
        self.db = db

    # ==================== Breakout Detection ====================

    async def get_52w_breakouts(self, breakout_type: str = "high") -> List[Dict]:
        """
        Get stocks at or near 52-week high/low breakouts.

        Args:
            breakout_type: "high" for 52W highs, "low" for 52W lows
        """
        try:
            # Fetch data from NSE
            data = await fetch_52week_data("gainers")

            if breakout_type == "high":
                # SecGtr20 = Securities within 20% of 52-week high
                if isinstance(data, dict) and 'SecGtr20' in data:
                    sec_data = data['SecGtr20']
                    if isinstance(sec_data, dict) and 'data' in sec_data:
                        stocks = sec_data['data']
                        return self._process_breakout_data(stocks, "52W_HIGH")

            elif breakout_type == "low":
                # SecLwr20 = Securities within 20% of 52-week low
                if isinstance(data, dict) and 'SecLwr20' in data:
                    sec_data = data['SecLwr20']
                    if isinstance(sec_data, dict) and 'data' in sec_data:
                        stocks = sec_data['data']
                        return self._process_breakout_data(stocks, "52W_LOW")

            return []

        except Exception as e:
            print(f"Error fetching 52W breakouts: {e}")
            return []

    def _process_breakout_data(self, stocks: List[Dict], breakout_type: str) -> List[Dict]:
        """
        Process and enhance breakout data with additional metrics.
        """
        processed = []

        for stock in stocks:
            try:
                symbol = stock.get("symbol", "")
                ltp = float(stock.get("lastPrice", 0) or stock.get("ltp", 0))
                high_52w = float(stock.get("high52", 0) or stock.get("yearHigh", 0))
                low_52w = float(stock.get("low52", 0) or stock.get("yearLow", 0))
                volume = float(stock.get("totalTradedVolume", 0))
                price_change_pct = float(stock.get("pChange", 0))

                if not symbol or ltp == 0:
                    continue

                # Calculate distance from 52W high/low
                distance_from_high_pct = ((high_52w - ltp) / high_52w * 100) if high_52w > 0 else 0
                distance_from_low_pct = ((ltp - low_52w) / low_52w * 100) if low_52w > 0 else 0

                # Determine breakout strength
                strength = self._calculate_breakout_strength(
                    breakout_type,
                    distance_from_high_pct,
                    distance_from_low_pct,
                    price_change_pct,
                    volume
                )

                processed.append({
                    "symbol": symbol,
                    "ltp": ltp,
                    "high52w": high_52w,
                    "low52w": low_52w,
                    "volume": volume,
                    "priceChange": stock.get("change", 0),
                    "priceChangePct": price_change_pct,
                    "distanceFromHighPct": round(distance_from_high_pct, 2),
                    "distanceFromLowPct": round(distance_from_low_pct, 2),
                    "breakoutType": breakout_type,
                    "strength": strength,
                    "lastUpdated": stock.get("lastUpdateTime", "")
                })

            except Exception as e:
                print(f"Error processing stock {stock.get('symbol')}: {e}")
                continue

        # Sort by strength and distance
        if breakout_type == "52W_HIGH":
            processed.sort(key=lambda x: (x["strength"] == "STRONG", -x["distanceFromHighPct"]), reverse=True)
        else:
            processed.sort(key=lambda x: (x["strength"] == "STRONG", x["distanceFromLowPct"]), reverse=True)

        return processed

    def _calculate_breakout_strength(
        self,
        breakout_type: str,
        dist_from_high: float,
        dist_from_low: float,
        price_change_pct: float,
        volume: float
    ) -> str:
        """
        Calculate breakout strength based on multiple factors.

        Returns: "STRONG", "MODERATE", or "WEAK"
        """
        if breakout_type == "52W_HIGH":
            # For 52W high breakouts
            if dist_from_high <= 2 and price_change_pct > 2:
                # Within 2% of 52W high with >2% gain
                return "STRONG"
            elif dist_from_high <= 5 and price_change_pct > 1:
                # Within 5% of 52W high with >1% gain
                return "MODERATE"
            else:
                return "WEAK"

        else:  # 52W_LOW
            # For 52W low breakouts (potential reversals)
            if dist_from_low >= 10 and price_change_pct > 3:
                # >10% above 52W low with >3% gain (reversal)
                return "STRONG"
            elif dist_from_low >= 5 and price_change_pct > 1:
                # >5% above 52W low with >1% gain
                return "MODERATE"
            else:
                return "WEAK"

    # ==================== Stock Analysis ====================

    async def analyze_stock(self, symbol: str) -> Optional[Dict]:
        """
        Analyze a specific stock for swing trading opportunities.
        Returns breakout status, trend, and swing signals.
        """
        try:
            # Fetch current 52W data to find the stock
            high_data = await self.get_52w_breakouts("high")
            low_data = await self.get_52w_breakouts("low")

            # Find the stock in either list
            stock_info = None
            for stock in high_data + low_data:
                if stock["symbol"] == symbol:
                    stock_info = stock
                    break

            if not stock_info:
                return None

            # Enhanced analysis
            analysis = {
                "symbol": symbol,
                "currentPrice": stock_info["ltp"],
                "high52w": stock_info["high52w"],
                "low52w": stock_info["low52w"],
                "priceChangePct": stock_info["priceChangePct"],
                "volume": stock_info["volume"],

                # Breakout status
                "nearHigh": stock_info["distanceFromHighPct"] <= 10,
                "nearLow": stock_info["distanceFromLowPct"] <= 10,
                "breakoutType": stock_info["breakoutType"],
                "breakoutStrength": stock_info["strength"],

                # Swing signals
                "swingSignal": self._get_swing_signal(stock_info),
                "distanceFromHigh": stock_info["distanceFromHighPct"],
                "distanceFromLow": stock_info["distanceFromLowPct"],
            }

            return analysis

        except Exception as e:
            print(f"Error analyzing stock {symbol}: {e}")
            return None

    def _get_swing_signal(self, stock: Dict) -> str:
        """
        Generate swing trading signal based on breakout data.
        """
        breakout_type = stock["breakoutType"]
        strength = stock["strength"]
        price_change = stock["priceChangePct"]

        if breakout_type == "52W_HIGH":
            if strength == "STRONG" and price_change > 2:
                return "BULLISH_BREAKOUT"
            elif strength == "MODERATE":
                return "BULLISH_MOMENTUM"
            else:
                return "WATCH"

        else:  # 52W_LOW
            if strength == "STRONG" and price_change > 3:
                return "REVERSAL_CANDIDATE"
            elif stock["distanceFromLowPct"] >= 15:
                return "RECOVERY_PLAY"
            else:
                return "AVOID"

    # ==================== Snapshot Storage ====================

    async def store_breakout_snapshot(self) -> int:
        """
        Store current breakout data as a snapshot.
        Returns count of breakouts stored.
        """
        try:
            now = datetime.now()
            today = date.today()

            # Fetch both high and low breakouts
            high_breakouts = await self.get_52w_breakouts("high")
            low_breakouts = await self.get_52w_breakouts("low")

            count = 0

            # Store 52W high breakouts
            for stock in high_breakouts[:20]:  # Top 20
                snapshot = SwingSpectrumBreakout(
                    snapshot_time=now,
                    trade_date=today,
                    symbol=stock["symbol"],
                    breakout_type="52W_HIGH",
                    ltp=stock["ltp"],
                    price_52w_high=stock["high52w"],
                    price_52w_low=stock["low52w"],
                    distance_from_high_pct=stock["distanceFromHighPct"],
                    distance_from_low_pct=stock["distanceFromLowPct"],
                    volume=stock["volume"],
                    price_change_pct=stock["priceChangePct"],
                    breakout_strength=stock["strength"]
                )
                self.db.add(snapshot)
                count += 1

            # Store 52W low breakouts
            for stock in low_breakouts[:20]:  # Top 20
                snapshot = SwingSpectrumBreakout(
                    snapshot_time=now,
                    trade_date=today,
                    symbol=stock["symbol"],
                    breakout_type="52W_LOW",
                    ltp=stock["ltp"],
                    price_52w_high=stock["high52w"],
                    price_52w_low=stock["low52w"],
                    distance_from_high_pct=stock["distanceFromHighPct"],
                    distance_from_low_pct=stock["distanceFromLowPct"],
                    volume=stock["volume"],
                    price_change_pct=stock["priceChangePct"],
                    breakout_strength=stock["strength"]
                )
                self.db.add(snapshot)
                count += 1

            self.db.commit()
            print(f"Swing Spectrum: Stored {count} breakout snapshots")
            return count

        except Exception as e:
            print(f"Error storing breakout snapshot: {e}")
            self.db.rollback()
            return 0

    # ==================== Daily Summary ====================

    async def generate_daily_summary(self, trade_date: date = None) -> bool:
        """
        Generate end-of-day Swing Spectrum summary.
        """
        if not trade_date:
            trade_date = date.today()

        try:
            # Get breakouts
            high_breakouts = await self.get_52w_breakouts("high")
            low_breakouts = await self.get_52w_breakouts("low")

            # Filter for strong breakouts only
            strong_highs = [s for s in high_breakouts if s["strength"] == "STRONG"]
            strong_lows = [s for s in low_breakouts if s["strength"] == "STRONG"]

            # Create or update summary
            summary = self.db.query(SwingSpectrumDailySummary).filter(
                SwingSpectrumDailySummary.trade_date == trade_date
            ).first()

            if not summary:
                summary = SwingSpectrumDailySummary(trade_date=trade_date)
                self.db.add(summary)

            summary.top_52w_highs = json.dumps(strong_highs[:10])
            summary.top_52w_lows = json.dumps(strong_lows[:10])
            summary.total_52w_highs = len(high_breakouts)
            summary.total_52w_lows = len(low_breakouts)

            self.db.commit()
            print(f"Swing Spectrum daily summary generated for {trade_date}")
            return True

        except Exception as e:
            print(f"Error generating daily summary: {e}")
            self.db.rollback()
            return False
