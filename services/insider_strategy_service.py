"""
Insider Strategy Service - Multi-factor composite scoring for high-reward trades.

Scoring Formula:
Composite Score = (Momentum × 40%) + (Volume × 30%) + (OI × 30%)

Grades:
- A: 80+ (Highest conviction)
- B: 60-79 (Good setup)
- C: 40-59 (Moderate setup)
- D: <40 (Weak setup)
"""
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc
import json

from database.models import InsiderStrategyPick, InsiderStrategyPerformance
from nse_data.movers import get_top_gainers, get_top_losers


class InsiderStrategyService:
    """Service for Insider Strategy multi-factor scoring and pick generation."""

    def __init__(self, db: Session):
        self.db = db

    # ==================== Composite Scoring ====================

    def calculate_momentum_score(
        self,
        price_change_pct: float,
        rsi: float = None,
        volume_ratio: float = None
    ) -> float:
        """
        Calculate momentum score (0-100) based on price action.

        Factors:
        - Price change % (primary)
        - RSI (if available)
        - Volume confirmation
        """
        score = 0.0

        # Price change contribution (60% of momentum score)
        if price_change_pct >= 5:
            score += 60
        elif price_change_pct >= 3:
            score += 45
        elif price_change_pct >= 2:
            score += 30
        elif price_change_pct >= 1:
            score += 15
        elif price_change_pct <= -5:
            score += 60  # Strong bearish momentum
        elif price_change_pct <= -3:
            score += 45

        # RSI contribution (25% of momentum score)
        if rsi is not None:
            if rsi >= 70:  # Overbought - bullish momentum
                score += 25
            elif rsi >= 60:
                score += 20
            elif rsi <= 30:  # Oversold - bearish momentum
                score += 25
            elif rsi <= 40:
                score += 20
            else:
                score += 10  # Neutral

        # Volume confirmation (15% of momentum score)
        if volume_ratio is not None and volume_ratio >= 2.0:
            score += 15
        elif volume_ratio is not None and volume_ratio >= 1.5:
            score += 10

        return min(score, 100)

    def calculate_volume_score(
        self,
        volume_ratio: float,
        delivery_pct: float = None
    ) -> float:
        """
        Calculate volume score (0-100) based on trading activity.

        Factors:
        - Volume ratio (current vs average)
        - Delivery percentage (if available)
        """
        score = 0.0

        # Volume ratio contribution (70% of volume score)
        if volume_ratio >= 3.0:
            score += 70
        elif volume_ratio >= 2.5:
            score += 60
        elif volume_ratio >= 2.0:
            score += 50
        elif volume_ratio >= 1.5:
            score += 35
        elif volume_ratio >= 1.2:
            score += 20

        # Delivery percentage contribution (30% of volume score)
        if delivery_pct is not None:
            if delivery_pct >= 70:
                score += 30  # Strong institutional interest
            elif delivery_pct >= 60:
                score += 25
            elif delivery_pct >= 50:
                score += 20
            elif delivery_pct >= 40:
                score += 15

        return min(score, 100)

    def calculate_oi_score(
        self,
        oi_change_pct: float = None,
        pcr_ratio: float = None
    ) -> float:
        """
        Calculate Open Interest score (0-100) for options activity.

        Factors:
        - OI change percentage
        - PCR (Put-Call Ratio)

        Note: For stocks without options, returns default moderate score.
        """
        if oi_change_pct is None and pcr_ratio is None:
            # No options data available - return neutral score
            return 50

        score = 0.0

        # OI change contribution (60% of OI score)
        if oi_change_pct is not None:
            if oi_change_pct >= 30:
                score += 60  # Strong buildup
            elif oi_change_pct >= 20:
                score += 50
            elif oi_change_pct >= 10:
                score += 40
            elif oi_change_pct >= 5:
                score += 30
            elif oi_change_pct <= -30:
                score += 60  # Strong unwinding (reversal signal)
            elif oi_change_pct <= -20:
                score += 50

        # PCR contribution (40% of OI score)
        if pcr_ratio is not None:
            if pcr_ratio >= 1.5:
                score += 40  # Bullish (more puts = support)
            elif pcr_ratio >= 1.2:
                score += 30
            elif pcr_ratio <= 0.7:
                score += 40  # Bearish (more calls = resistance)
            elif pcr_ratio <= 0.9:
                score += 30
            else:
                score += 20  # Neutral

        return min(score, 100)

    def calculate_composite_score(
        self,
        momentum_score: float,
        volume_score: float,
        oi_score: float
    ) -> Tuple[float, str]:
        """
        Calculate composite score and assign grade.

        Formula: (Momentum × 40%) + (Volume × 30%) + (OI × 30%)

        Returns:
            Tuple of (composite_score, grade)
        """
        composite = (
            (momentum_score * 0.40) +
            (volume_score * 0.30) +
            (oi_score * 0.30)
        )

        # Assign grade
        if composite >= 80:
            grade = "A"
        elif composite >= 60:
            grade = "B"
        elif composite >= 40:
            grade = "C"
        else:
            grade = "D"

        return round(composite, 2), grade

    # ==================== Pattern Recognition ====================

    def detect_pattern(
        self,
        symbol: str,
        price_data: List[float] = None
    ) -> Tuple[Optional[str], float]:
        """
        Detect chart patterns in price data.

        Patterns:
        - Cup & Handle
        - Bull Flag
        - Bear Flag
        - Ascending Triangle
        - Descending Triangle

        Returns:
            Tuple of (pattern_name, confidence_pct)
        """
        if not price_data or len(price_data) < 10:
            return None, 0.0

        # Simple pattern detection (placeholder - can be enhanced)
        # In production, this would use more sophisticated technical analysis

        # Check for Cup & Handle (simplified)
        if self._is_cup_and_handle(price_data):
            return "Cup & Handle", 75.0

        # Check for Bull Flag
        if self._is_bull_flag(price_data):
            return "Bull Flag", 70.0

        # Check for Bear Flag
        if self._is_bear_flag(price_data):
            return "Bear Flag", 70.0

        return None, 0.0

    def _is_cup_and_handle(self, prices: List[float]) -> bool:
        """Simplified Cup & Handle detection."""
        if len(prices) < 15:
            return False

        # Look for U-shaped pattern followed by small consolidation
        mid_point = len(prices) // 2
        left_side = prices[:mid_point]
        right_side = prices[mid_point:]

        # Check if sides are roughly symmetrical and price recovered
        if min(left_side) == min(right_side) and prices[-1] > prices[0] * 0.95:
            return True

        return False

    def _is_bull_flag(self, prices: List[float]) -> bool:
        """Simplified Bull Flag detection."""
        if len(prices) < 10:
            return False

        # Sharp rise followed by consolidation
        first_half = prices[:len(prices)//2]
        second_half = prices[len(prices)//2:]

        avg_first = sum(first_half) / len(first_half)
        avg_second = sum(second_half) / len(second_half)

        # First half should show strong uptrend, second half consolidation
        if avg_second > avg_first * 1.05 and max(second_half) - min(second_half) < avg_second * 0.05:
            return True

        return False

    def _is_bear_flag(self, prices: List[float]) -> bool:
        """Simplified Bear Flag detection."""
        if len(prices) < 10:
            return False

        # Sharp fall followed by consolidation
        first_half = prices[:len(prices)//2]
        second_half = prices[len(prices)//2:]

        avg_first = sum(first_half) / len(first_half)
        avg_second = sum(second_half) / len(second_half)

        # First half should show strong downtrend, second half consolidation
        if avg_second < avg_first * 0.95 and max(second_half) - min(second_half) < avg_second * 0.05:
            return True

        return False

    # ==================== Entry/Target/Stop Calculation ====================

    def calculate_levels(
        self,
        entry_price: float,
        pick_type: str,
        risk_reward_ratio: float = 2.0
    ) -> Dict[str, float]:
        """
        Calculate entry, target, and stop-loss levels.

        Args:
            entry_price: Current market price
            pick_type: "BULLISH" or "BEARISH"
            risk_reward_ratio: Target distance / Stop distance (default 2:1)

        Returns:
            Dict with entry, target, stop_loss
        """
        if pick_type == "BULLISH":
            # For bullish picks
            stop_loss = entry_price * 0.95  # 5% stop-loss
            risk = entry_price - stop_loss
            target = entry_price + (risk * risk_reward_ratio)  # 2:1 R:R = 10% target

        else:  # BEARISH
            # For bearish picks (short)
            stop_loss = entry_price * 1.05  # 5% stop-loss
            risk = stop_loss - entry_price
            target = entry_price - (risk * risk_reward_ratio)  # 2:1 R:R = 10% target

        return {
            "entry_price": round(entry_price, 2),
            "target_price": round(target, 2),
            "stop_loss": round(stop_loss, 2),
            "risk_pct": 5.0,
            "reward_pct": 10.0
        }

    # ==================== Pick Generation ====================

    async def generate_picks(self, min_grade: str = "B") -> List[Dict]:
        """
        Generate new Insider Strategy picks based on current market data.

        Args:
            min_grade: Minimum grade to include (A, B, C, D)

        Returns:
            List of picks with scores and levels
        """
        picks = []

        try:
            # Fetch top gainers and losers
            gainers_data = await get_top_gainers()
            losers_data = await get_top_losers()

            # Process gainers (bullish picks)
            if isinstance(gainers_data, dict) and 'data' in gainers_data:
                for stock in gainers_data['data'][:20]:  # Top 20
                    pick = await self._analyze_stock_for_pick(stock, "BULLISH")
                    if pick and self._meets_grade_criteria(pick['grade'], min_grade):
                        picks.append(pick)

            # Process losers (bearish/reversal picks)
            if isinstance(losers_data, dict) and 'data' in losers_data:
                for stock in losers_data['data'][:20]:  # Top 20
                    pick = await self._analyze_stock_for_pick(stock, "BEARISH")
                    if pick and self._meets_grade_criteria(pick['grade'], min_grade):
                        picks.append(pick)

            # Sort by composite score
            picks.sort(key=lambda x: x['composite_score'], reverse=True)

            return picks[:50]  # Return top 50 picks

        except Exception as e:
            print(f"Error generating picks: {e}")
            return []

    async def _analyze_stock_for_pick(self, stock: Dict, pick_type: str) -> Optional[Dict]:
        """Analyze a single stock and generate pick data."""
        try:
            symbol = stock.get("symbol", "")
            ltp = float(stock.get("lastPrice", 0) or stock.get("ltp", 0))
            price_change_pct = float(stock.get("pChange", 0))
            volume = float(stock.get("totalTradedVolume", 0))

            if not symbol or ltp == 0:
                return None

            # Estimate volume ratio (simplified - would need historical avg in production)
            volume_ratio = 2.0 if abs(price_change_pct) >= 3 else 1.5

            # Calculate scores
            momentum_score = self.calculate_momentum_score(
                price_change_pct=price_change_pct,
                rsi=None,  # Would fetch from technical indicators
                volume_ratio=volume_ratio
            )

            volume_score = self.calculate_volume_score(
                volume_ratio=volume_ratio,
                delivery_pct=None  # Would fetch from delivery data
            )

            oi_score = self.calculate_oi_score(
                oi_change_pct=None,  # Would fetch from option chain
                pcr_ratio=None
            )

            composite_score, grade = self.calculate_composite_score(
                momentum_score, volume_score, oi_score
            )

            # Calculate entry/target/stop levels
            levels = self.calculate_levels(ltp, pick_type)

            # Pattern detection (simplified without historical data)
            pattern, confidence = None, 0.0

            return {
                "symbol": symbol,
                "pick_type": pick_type,
                "entry_price": levels["entry_price"],
                "target_price": levels["target_price"],
                "stop_loss": levels["stop_loss"],
                "current_price": ltp,
                "momentum_score": round(momentum_score, 2),
                "volume_score": round(volume_score, 2),
                "oi_score": round(oi_score, 2),
                "composite_score": composite_score,
                "grade": grade,
                "pattern_detected": pattern,
                "pattern_confidence": confidence,
                "price_change_pct": price_change_pct,
                "volume_ratio": volume_ratio,
                "status": "ACTIVE",
                "pick_date": date.today()
            }

        except Exception as e:
            print(f"Error analyzing stock {stock.get('symbol')}: {e}")
            return None

    def _meets_grade_criteria(self, pick_grade: str, min_grade: str) -> bool:
        """Check if pick grade meets minimum criteria."""
        grade_order = {"A": 4, "B": 3, "C": 2, "D": 1}
        return grade_order.get(pick_grade, 0) >= grade_order.get(min_grade, 0)

    # ==================== Database Operations ====================

    async def store_pick(self, pick_data: Dict) -> Optional[int]:
        """Store a new pick in the database."""
        try:
            pick = InsiderStrategyPick(
                pick_date=pick_data["pick_date"],
                symbol=pick_data["symbol"],
                entry_price=pick_data["entry_price"],
                target_price=pick_data["target_price"],
                stop_loss=pick_data["stop_loss"],
                current_price=pick_data["current_price"],
                momentum_score=pick_data["momentum_score"],
                volume_score=pick_data["volume_score"],
                oi_score=pick_data["oi_score"],
                composite_score=pick_data["composite_score"],
                grade=pick_data["grade"],
                pattern_detected=pick_data.get("pattern_detected"),
                pattern_confidence=pick_data.get("pattern_confidence"),
                price_change_pct=pick_data.get("price_change_pct"),
                volume_ratio=pick_data.get("volume_ratio"),
                status=pick_data["status"],
                pick_type=pick_data["pick_type"]
            )

            self.db.add(pick)
            self.db.commit()
            self.db.refresh(pick)

            return pick.id

        except Exception as e:
            print(f"Error storing pick: {e}")
            self.db.rollback()
            return None

    def get_active_picks(self, min_grade: str = None) -> List[Dict]:
        """Get all active picks from database."""
        try:
            query = self.db.query(InsiderStrategyPick).filter(
                InsiderStrategyPick.status == "ACTIVE"
            )

            if min_grade:
                query = query.filter(InsiderStrategyPick.grade.in_(
                    self._get_grades_above(min_grade)
                ))

            picks = query.order_by(desc(InsiderStrategyPick.composite_score)).all()

            return [self._pick_to_dict(pick) for pick in picks]

        except Exception as e:
            print(f"Error fetching active picks: {e}")
            return []

    def _get_grades_above(self, min_grade: str) -> List[str]:
        """Get list of grades at or above minimum."""
        all_grades = ["A", "B", "C", "D"]
        grade_order = {"A": 4, "B": 3, "C": 2, "D": 1}
        min_level = grade_order.get(min_grade, 1)

        return [g for g in all_grades if grade_order[g] >= min_level]

    def _pick_to_dict(self, pick: InsiderStrategyPick) -> Dict:
        """Convert pick model to dictionary."""
        return {
            "id": pick.id,
            "symbol": pick.symbol,
            "pick_type": pick.pick_type,
            "pick_date": pick.pick_date.isoformat() if pick.pick_date else None,
            "entry_price": pick.entry_price,
            "target_price": pick.target_price,
            "stop_loss": pick.stop_loss,
            "current_price": pick.current_price,
            "momentum_score": pick.momentum_score,
            "volume_score": pick.volume_score,
            "oi_score": pick.oi_score,
            "composite_score": pick.composite_score,
            "grade": pick.grade,
            "pattern_detected": pick.pattern_detected,
            "pattern_confidence": pick.pattern_confidence,
            "price_change_pct": pick.price_change_pct,
            "volume_ratio": pick.volume_ratio,
            "status": pick.status,
            "created_at": pick.created_at.isoformat() if pick.created_at else None
        }
