"""
Market Pulse Service - Detects smart money flow and institutional activity.

Features:
- Volume surge detection (>2x average)
- High delivery % stocks (>60%)
- Bulk/block trade tracking
- Accumulation/Distribution scoring
"""
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
import json

from database.models import (
    VolumeBaseline,
    MarketPulseSnapshot,
    BulkBlockDeal,
    MarketPulseDailySummary
)
from nse_data.most_active import fetch_most_active_data
from nse_data.movers import fetch_index_data
from nse_data.delivery import fetch_delivery_data_for_symbol, fetch_bulk_delivery_leaders
from nse_data.bulk_deals import fetch_with_retry, SNAPSHOT_URL


class MarketPulseService:
    """Service for Market Pulse signal detection and storage."""

    def __init__(self, db: Session):
        self.db = db

    # ==================== Volume Baseline Management ====================

    async def update_volume_baselines(self, symbols: List[str] = None):
        """
        Update 20-day average volume for stocks.
        Called daily after market close.
        """
        if not symbols:
            # Get NIFTY 200 as default universe
            stocks = await fetch_index_data("NIFTY 200")
            symbols = [s.get("symbol") for s in stocks if s.get("symbol")]

        today = date.today()

        for symbol in symbols:
            try:
                # Fetch current volume data
                stock_data = await self._get_stock_volume_data(symbol)
                if not stock_data:
                    continue

                # Calculate 20-day average (simplified - using current as baseline for now)
                # TODO: Integrate with Fyers historical data for accurate 20-day average
                avg_volume = stock_data.get("totalTradedVolume", 0)
                avg_value = stock_data.get("totalTradedValue", 0)

                # Upsert volume baseline
                baseline = self.db.query(VolumeBaseline).filter(
                    VolumeBaseline.symbol == symbol
                ).first()

                if baseline:
                    baseline.avg_volume_20d = avg_volume
                    baseline.avg_value_20d = avg_value
                    baseline.last_updated = today
                else:
                    baseline = VolumeBaseline(
                        symbol=symbol,
                        avg_volume_20d=avg_volume,
                        avg_value_20d=avg_value,
                        last_updated=today
                    )
                    self.db.add(baseline)

            except Exception as e:
                print(f"Error updating baseline for {symbol}: {e}")
                continue

        self.db.commit()
        print(f"Updated volume baselines for {len(symbols)} symbols")

    async def _get_stock_volume_data(self, symbol: str) -> Optional[Dict]:
        """Get current volume data for a stock from NSE."""
        try:
            stocks = await fetch_index_data("NIFTY 200")
            for stock in stocks:
                if stock.get("symbol") == symbol:
                    return stock
            return None
        except Exception as e:
            print(f"Error fetching volume data for {symbol}: {e}")
            return None

    # ==================== Volume Surge Detection ====================

    async def detect_volume_surges(self, min_surge_ratio: float = 2.0) -> List[Dict]:
        """
        Detect stocks with volume surge >2x average.
        Returns list of stocks with surge details.
        """
        try:
            # Fetch most active stocks
            most_active = await fetch_most_active_data("volume")
            if isinstance(most_active, dict):
                stocks = most_active.get("data", [])
            else:
                stocks = most_active

            surges = []
            for stock in stocks[:50]:  # Top 50 most active
                symbol = stock.get("symbol")
                if not symbol:
                    continue

                # Get volume baseline
                baseline = self.db.query(VolumeBaseline).filter(
                    VolumeBaseline.symbol == symbol
                ).first()

                current_volume = float(stock.get("totalTradedVolume", 0))

                if baseline and baseline.avg_volume_20d > 0:
                    surge_ratio = current_volume / baseline.avg_volume_20d

                    if surge_ratio >= min_surge_ratio:
                        surges.append({
                            "symbol": symbol,
                            "currentVolume": current_volume,
                            "avgVolume": baseline.avg_volume_20d,
                            "surgeRatio": round(surge_ratio, 2),
                            "lastPrice": stock.get("lastPrice", 0),
                            "priceChange": stock.get("pChange", 0),
                            "signalStrength": self._get_signal_strength(surge_ratio)
                        })

            # Sort by surge ratio descending
            surges.sort(key=lambda x: x["surgeRatio"], reverse=True)
            return surges

        except Exception as e:
            print(f"Error detecting volume surges: {e}")
            return []

    # ==================== Delivery Leaders ====================

    async def get_delivery_leaders(self, min_delivery_pct: float = 60.0) -> List[Dict]:
        """
        Get stocks with high delivery percentage.
        Indicates strong investor conviction.
        """
        try:
            leaders = await fetch_bulk_delivery_leaders(min_delivery_pct)
            return leaders
        except Exception as e:
            print(f"Error fetching delivery leaders: {e}")
            return []

    # ==================== Bulk/Block Deals ====================

    async def fetch_and_store_bulk_deals(self) -> Dict:
        """
        Fetch today's bulk and block deals from NSE and store in DB.
        Returns summary of deals.
        """
        try:
            data = await fetch_with_retry(SNAPSHOT_URL)
            if not data:
                return {"bulk_deals": 0, "block_deals": 0}

            today = date.today()
            bulk_count = 0
            block_count = 0

            # Store bulk deals
            if "bulk" in data and "data" in data["bulk"]:
                for deal in data["bulk"]["data"]:
                    self._store_deal(deal, "BULK", today)
                    bulk_count += 1

            # Store block deals
            if "block" in data and "data" in data["block"]:
                for deal in data["block"]["data"]:
                    self._store_deal(deal, "BLOCK", today)
                    block_count += 1

            self.db.commit()

            return {"bulk_deals": bulk_count, "block_deals": block_count}

        except Exception as e:
            print(f"Error fetching bulk/block deals: {e}")
            return {"bulk_deals": 0, "block_deals": 0}

    def _store_deal(self, deal: Dict, deal_type: str, trade_date: date):
        """Store a single bulk/block deal in DB."""
        try:
            # Check if deal already exists (prevent duplicates)
            existing = self.db.query(BulkBlockDeal).filter(
                BulkBlockDeal.trade_date == trade_date,
                BulkBlockDeal.symbol == deal.get("symbol"),
                BulkBlockDeal.deal_type == deal_type,
                BulkBlockDeal.client_name == deal.get("clientName"),
                BulkBlockDeal.quantity == deal.get("quantity")
            ).first()

            if existing:
                return

            # Extract price (handle both key formats)
            price = deal.get("tradePrice") or deal.get("avgPrice", 0)

            deal_record = BulkBlockDeal(
                trade_date=trade_date,
                deal_type=deal_type,
                symbol=deal.get("symbol"),
                client_name=deal.get("clientName"),
                buy_sell=deal.get("buySell", "BUY"),
                quantity=float(deal.get("quantity", 0)),
                trade_price=float(price),
                remarks=deal.get("remarks")
            )
            self.db.add(deal_record)

        except Exception as e:
            print(f"Error storing deal: {e}")

    def get_bulk_activity(self, symbol: Optional[str] = None, days: int = 1) -> List[Dict]:
        """
        Get bulk/block deal activity for a symbol or all stocks.
        """
        try:
            query = self.db.query(BulkBlockDeal).filter(
                BulkBlockDeal.trade_date >= date.today() - timedelta(days=days)
            )

            if symbol:
                query = query.filter(BulkBlockDeal.symbol == symbol)

            deals = query.order_by(desc(BulkBlockDeal.trade_date)).all()

            return [{
                "symbol": deal.symbol,
                "dealType": deal.deal_type,
                "clientName": deal.client_name,
                "buySell": deal.buy_sell,
                "quantity": deal.quantity,
                "price": deal.trade_price,
                "value": deal.quantity * deal.trade_price,
                "date": deal.trade_date.isoformat()
            } for deal in deals]

        except Exception as e:
            print(f"Error fetching bulk activity: {e}")
            return []

    # ==================== Accumulation/Distribution Scoring ====================

    def calculate_ad_score(self, stock_data: Dict) -> float:
        """
        Calculate Accumulation/Distribution score based on price, volume, and delivery.
        Score: -100 (strong distribution) to +100 (strong accumulation)
        """
        try:
            price_change = float(stock_data.get("priceChange", 0))
            volume_ratio = float(stock_data.get("volumeRatio", 1.0))  # current / avg
            delivery_pct = float(stock_data.get("deliveryPct", 0))

            # Price momentum score (-50 to +50)
            price_score = min(max(price_change * 5, -50), 50)

            # Volume score (0 to +30)
            volume_score = min((volume_ratio - 1) * 15, 30) if volume_ratio > 1 else 0

            # Delivery score (0 to +20)
            delivery_score = min(delivery_pct / 5, 20) if delivery_pct > 50 else 0

            # Combined score
            ad_score = price_score + volume_score + delivery_score

            return round(ad_score, 2)

        except Exception as e:
            print(f"Error calculating A/D score: {e}")
            return 0.0

    # ==================== Snapshot Generation ====================

    async def generate_snapshot(self):
        """
        Generate and store current Market Pulse snapshot.
        Called periodically during market hours.
        """
        try:
            now = datetime.now()
            today = date.today()

            # Detect volume surges
            surges = await self.detect_volume_surges()

            # Store snapshots for volume surge stocks
            for surge in surges[:20]:  # Top 20
                snapshot = MarketPulseSnapshot(
                    snapshot_time=now,
                    trade_date=today,
                    symbol=surge["symbol"],
                    current_volume=surge["currentVolume"],
                    avg_volume=surge["avgVolume"],
                    volume_surge_ratio=surge["surgeRatio"],
                    ltp=surge["lastPrice"],
                    price_change_pct=surge["priceChange"],
                    signal_type="VOLUME_SURGE",
                    signal_strength=surge["signalStrength"]
                )
                self.db.add(snapshot)

            self.db.commit()
            print(f"Market Pulse snapshot generated at {now}")

        except Exception as e:
            print(f"Error generating snapshot: {e}")
            self.db.rollback()

    # ==================== Daily Summary ====================

    async def generate_daily_summary(self, trade_date: date = None):
        """
        Generate end-of-day summary for Market Pulse.
        Called at market close.
        """
        if not trade_date:
            trade_date = date.today()

        try:
            # Get volume surges
            surges = await self.detect_volume_surges()
            top_surges = surges[:10]

            # Get delivery leaders
            delivery = await self.get_delivery_leaders()
            top_delivery = delivery[:10]

            # Get bulk deal stats
            bulk_deals = self.get_bulk_activity(days=1)
            bulk_buy_value = sum(d["value"] for d in bulk_deals if d["buySell"] == "BUY")
            bulk_sell_value = sum(d["value"] for d in bulk_deals if d["buySell"] == "SELL")

            # Create or update daily summary
            summary = self.db.query(MarketPulseDailySummary).filter(
                MarketPulseDailySummary.trade_date == trade_date
            ).first()

            if not summary:
                summary = MarketPulseDailySummary(trade_date=trade_date)
                self.db.add(summary)

            summary.top_volume_surges = json.dumps(top_surges)
            summary.top_delivery_stocks = json.dumps(top_delivery)
            summary.total_bulk_deals = len([d for d in bulk_deals if d["dealType"] == "BULK"])
            summary.total_block_deals = len([d for d in bulk_deals if d["dealType"] == "BLOCK"])
            summary.bulk_buy_value = bulk_buy_value
            summary.bulk_sell_value = bulk_sell_value
            summary.net_institutional_flow = bulk_buy_value - bulk_sell_value

            self.db.commit()
            print(f"Daily summary generated for {trade_date}")

        except Exception as e:
            print(f"Error generating daily summary: {e}")
            self.db.rollback()

    # ==================== Helper Methods ====================

    def _get_signal_strength(self, ratio: float) -> str:
        """Determine signal strength based on surge ratio."""
        if ratio >= 5.0:
            return "STRONG"
        elif ratio >= 3.0:
            return "MODERATE"
        else:
            return "WEAK"
