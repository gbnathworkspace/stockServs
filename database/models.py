from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Float, Date
from sqlalchemy.orm import relationship
from datetime import datetime
from database.connection import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    

class ZerodhaToken(Base):
    __tablename__ = "zerodha_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    access_token = Column(String(500), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)  
    zerodha_user_id = Column(String(50), nullable=False, unique=True)

class FyersToken(Base):
    __tablename__ = "fyers_tokens"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    access_token = Column(String(1000), nullable=False)
    refresh_token = Column(String(1000), nullable=True)
    fyers_id = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    display_name = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    preferences = Column(Text, nullable=True)  # JSON stored as text
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class LocalCredential(Base):
    __tablename__ = "local_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    email = Column(String(255), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=True)
    google_sub = Column(String(255), nullable=True, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class VirtualWallet(Base):
    """Virtual wallet for paper trading - tracks user's virtual cash balance."""
    __tablename__ = "virtual_wallets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    balance = Column(Float, nullable=False, default=100000.00)  # Starting balance: ₹1,00,000
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class VirtualHolding(Base):
    __tablename__ = "virtual_holdings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    symbol = Column(String(50), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    # Store average execution price as a float to avoid integer-cast errors on trades
    average_price = Column(Float, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class VirtualOrder(Base):
    """Order history for virtual trades."""
    __tablename__ = "virtual_orders"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    symbol = Column(String(50), nullable=False)
    side = Column(String(4), nullable=False)  # BUY or SELL
    quantity = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)
    total_value = Column(Float, nullable=False)
    order_type = Column(String(10), nullable=False, default="MARKET")  # MARKET, LIMIT, STOP
    status = Column(String(10), nullable=False, default="FILLED")  # PENDING, FILLED, CANCELLED
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ApiLog(Base):
    __tablename__ = "api_logs"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(64), nullable=False, index=True)
    path = Column(String(255), nullable=False, index=True)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=False)
    duration_ms = Column(Integer, nullable=False)
    client_ip = Column(String(64), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ErrorLog(Base):
    """Error log table to track non-200 API responses and exceptions."""
    __tablename__ = "error_logs"

    id = Column(Integer, primary_key=True, index=True)
    endpoint = Column(String(255), nullable=False, index=True)
    method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=False, index=True)
    error_type = Column(String(100), nullable=True)  # e.g., "HTTPException", "ValueError"
    error_message = Column(Text, nullable=True)
    request_body = Column(Text, nullable=True)
    query_params = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    client_ip = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)
    extra_data = Column(Text, nullable=True)  # JSON for additional context
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class FiiDiiActivity(Base):
    __tablename__ = "fii_dii_daily"

    id = Column(Integer, primary_key=True, index=True)
    trade_date = Column(Date, nullable=False, unique=True, index=True)
    fii_buy_value = Column(Float, nullable=True)
    fii_sell_value = Column(Float, nullable=True)
    fii_net_value = Column(Float, nullable=True)
    dii_buy_value = Column(Float, nullable=True)
    dii_sell_value = Column(Float, nullable=True)
    dii_net_value = Column(Float, nullable=True)
    source_date_str = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class OptionClockSnapshot(Base):
    """
    Option Clock OI Snapshots - stores aggregated option chain data every 15 minutes.
    Used for determining market direction based on OI changes.

    Data Retention Strategy:
    - Keep detailed intraday snapshots for 7 days (for intraday analysis)
    - Archive daily summaries beyond 7 days (for historical trends)
    - Cleanup job runs daily to remove old intraday data
    """
    __tablename__ = "option_clock_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)  # NIFTY, BANKNIFTY
    expiry_date = Column(Date, nullable=False, index=True)

    # Aggregated OI Data
    total_call_oi = Column(Float, nullable=True)
    total_put_oi = Column(Float, nullable=True)
    call_oi_change = Column(Float, nullable=True)  # Change from previous snapshot
    put_oi_change = Column(Float, nullable=True)

    # Derived Metrics
    pcr = Column(Float, nullable=True)  # Put-Call Ratio (put_oi / call_oi)
    pcr_change = Column(Float, nullable=True)  # PCR change from previous

    # Spot Price Data
    spot_price = Column(Float, nullable=True)
    price_change = Column(Float, nullable=True)  # Change from previous snapshot
    price_change_pct = Column(Float, nullable=True)

    # Signal Detection
    signal = Column(String(30), nullable=True)  # LONG_BUILDUP, SHORT_BUILDUP, etc.
    signal_strength = Column(String(10), nullable=True)  # STRONG, MODERATE, WEAK

    # Strike-wise breakdown (JSON stored as text for flexibility)
    strike_data = Column(Text, nullable=True)  # JSON: {strike: {call_oi, put_oi, call_change, put_change}}

    # Max Pain and Key Levels
    max_pain_strike = Column(Float, nullable=True)
    highest_call_oi_strike = Column(Float, nullable=True)
    highest_put_oi_strike = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class OptionClockDailySummary(Base):
    """
    Daily summary of Option Clock data for long-term historical analysis.
    Generated from intraday snapshots at market close.
    """
    __tablename__ = "option_clock_daily_summary"

    id = Column(Integer, primary_key=True, index=True)
    trade_date = Column(Date, nullable=False, index=True)
    symbol = Column(String(20), nullable=False, index=True)
    expiry_date = Column(Date, nullable=False)

    # Opening values (9:15 AM snapshot)
    opening_call_oi = Column(Float, nullable=True)
    opening_put_oi = Column(Float, nullable=True)
    opening_pcr = Column(Float, nullable=True)
    opening_spot = Column(Float, nullable=True)

    # Closing values (3:30 PM snapshot)
    closing_call_oi = Column(Float, nullable=True)
    closing_put_oi = Column(Float, nullable=True)
    closing_pcr = Column(Float, nullable=True)
    closing_spot = Column(Float, nullable=True)

    # Day's changes
    call_oi_day_change = Column(Float, nullable=True)
    put_oi_day_change = Column(Float, nullable=True)
    pcr_day_change = Column(Float, nullable=True)
    spot_day_change = Column(Float, nullable=True)
    spot_day_change_pct = Column(Float, nullable=True)

    # Key levels at close
    max_pain_strike = Column(Float, nullable=True)
    highest_call_oi_strike = Column(Float, nullable=True)
    highest_put_oi_strike = Column(Float, nullable=True)

    # Dominant signal of the day
    dominant_signal = Column(String(30), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


class Watchlist(Base):
    """User-created watchlists for tracking specific stocks."""
    __tablename__ = "watchlists"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    position = Column(Integer, nullable=False, default=0)  # 0-14 for watchlists 1-15
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    stocks = relationship("WatchlistStock", back_populates="watchlist", cascade="all, delete-orphan")


class WatchlistStock(Base):
    """Stocks within a watchlist."""
    __tablename__ = "watchlist_stocks"

    id = Column(Integer, primary_key=True, index=True)
    watchlist_id = Column(Integer, ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False, index=True)
    symbol = Column(String(50), nullable=False)
    position = Column(Integer, nullable=False, default=0)  # Order within watchlist
    added_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    watchlist = relationship("Watchlist", back_populates="stocks")


class VolumeBaseline(Base):
    """
    Stores 20-day average volume for stocks to detect volume surges.
    Updated daily after market close.
    """
    __tablename__ = "volume_baselines"

    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(50), nullable=False, unique=True, index=True)
    avg_volume_20d = Column(Float, nullable=False)  # 20-day average volume
    avg_value_20d = Column(Float, nullable=True)    # 20-day average traded value
    last_updated = Column(Date, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class MarketPulseSnapshot(Base):
    """
    Daily snapshots of Market Pulse signals - stores volume surges,
    delivery leaders, and smart money activity.
    Generated multiple times during market hours and at market close.
    """
    __tablename__ = "market_pulse_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_time = Column(DateTime, nullable=False, index=True)
    trade_date = Column(Date, nullable=False, index=True)

    # Stock identification
    symbol = Column(String(50), nullable=False, index=True)

    # Volume metrics
    current_volume = Column(Float, nullable=True)
    avg_volume = Column(Float, nullable=True)
    volume_surge_ratio = Column(Float, nullable=True)  # current / average

    # Delivery metrics
    delivery_qty = Column(Float, nullable=True)
    traded_qty = Column(Float, nullable=True)
    delivery_pct = Column(Float, nullable=True)

    # Price metrics
    ltp = Column(Float, nullable=True)
    price_change = Column(Float, nullable=True)
    price_change_pct = Column(Float, nullable=True)

    # Signal categorization
    signal_type = Column(String(30), nullable=True)  # VOLUME_SURGE, HIGH_DELIVERY, SMART_MONEY
    signal_strength = Column(String(10), nullable=True)  # STRONG, MODERATE, WEAK

    # Accumulation/Distribution
    ad_score = Column(Float, nullable=True)  # -100 to +100 (negative = distribution, positive = accumulation)

    created_at = Column(DateTime, default=datetime.utcnow)


class BulkBlockDeal(Base):
    """
    Stores bulk and block deal transactions from NSE.
    Used to track institutional activity and smart money flow.
    """
    __tablename__ = "bulk_block_deals"

    id = Column(Integer, primary_key=True, index=True)
    trade_date = Column(Date, nullable=False, index=True)
    deal_type = Column(String(10), nullable=False)  # BULK or BLOCK

    # Deal details
    symbol = Column(String(50), nullable=False, index=True)
    client_name = Column(String(255), nullable=True)
    buy_sell = Column(String(4), nullable=False)  # BUY or SELL
    quantity = Column(Float, nullable=False)
    trade_price = Column(Float, nullable=False)

    # Metadata
    remarks = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class MarketPulseDailySummary(Base):
    """
    End-of-day summary for Market Pulse - top volume surges,
    delivery leaders, and smart money activity for the trading day.
    """
    __tablename__ = "market_pulse_daily_summary"

    id = Column(Integer, primary_key=True, index=True)
    trade_date = Column(Date, nullable=False, unique=True, index=True)

    # Top performers (stored as JSON)
    top_volume_surges = Column(Text, nullable=True)  # JSON: [{symbol, surge_ratio, volume}]
    top_delivery_stocks = Column(Text, nullable=True)  # JSON: [{symbol, delivery_pct, qty}]
    top_accumulation = Column(Text, nullable=True)  # JSON: [{symbol, ad_score, signals}]
    top_distribution = Column(Text, nullable=True)  # JSON: [{symbol, ad_score, signals}]

    # Aggregate metrics
    total_bulk_deals = Column(Integer, nullable=True)
    total_block_deals = Column(Integer, nullable=True)
    bulk_buy_value = Column(Float, nullable=True)
    bulk_sell_value = Column(Float, nullable=True)
    net_institutional_flow = Column(Float, nullable=True)  # buy - sell

    created_at = Column(DateTime, default=datetime.utcnow)


class SwingSpectrumBreakout(Base):
    """
    Swing Spectrum breakout snapshots - tracks stocks at 52-week highs/lows
    and breakout patterns for medium-term swing trading.
    """
    __tablename__ = "swing_spectrum_breakouts"

    id = Column(Integer, primary_key=True, index=True)
    snapshot_time = Column(DateTime, nullable=False, index=True)
    trade_date = Column(Date, nullable=False, index=True)

    # Stock identification
    symbol = Column(String(50), nullable=False, index=True)

    # Breakout type
    breakout_type = Column(String(20), nullable=False)  # 52W_HIGH, 52W_LOW, RESISTANCE_BREAK, SUPPORT_BREAK

    # Price data
    ltp = Column(Float, nullable=True)
    price_52w_high = Column(Float, nullable=True)
    price_52w_low = Column(Float, nullable=True)
    distance_from_high_pct = Column(Float, nullable=True)  # % distance from 52W high
    distance_from_low_pct = Column(Float, nullable=True)   # % distance from 52W low

    # Volume metrics
    volume = Column(Float, nullable=True)
    avg_volume_20d = Column(Float, nullable=True)
    volume_ratio = Column(Float, nullable=True)  # current / avg

    # Price changes
    price_change = Column(Float, nullable=True)
    price_change_pct = Column(Float, nullable=True)

    # Breakout strength
    breakout_strength = Column(String(10), nullable=True)  # STRONG, MODERATE, WEAK

    created_at = Column(DateTime, default=datetime.utcnow)


class SwingSpectrumDailySummary(Base):
    """
    End-of-day summary for Swing Spectrum - top breakouts and swing opportunities.
    """
    __tablename__ = "swing_spectrum_daily_summary"

    id = Column(Integer, primary_key=True, index=True)
    trade_date = Column(Date, nullable=False, unique=True, index=True)

    # Top breakouts (stored as JSON)
    top_52w_highs = Column(Text, nullable=True)  # JSON: [{symbol, price, strength}]
    top_52w_lows = Column(Text, nullable=True)   # JSON: [{symbol, price, strength}]
    resistance_breaks = Column(Text, nullable=True)  # JSON: stocks breaking resistance
    support_breaks = Column(Text, nullable=True)     # JSON: stocks breaking support

    # Aggregate metrics
    total_52w_highs = Column(Integer, nullable=True)
    total_52w_lows = Column(Integer, nullable=True)
    avg_breakout_volume_ratio = Column(Float, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


# ==================== Insider Strategy Tables ====================

class InsiderStrategyPick(Base):
    """
    Individual stock picks with multi-factor composite scoring.
    Combines momentum, volume, and OI analysis for high-reward trade opportunities.
    """
    __tablename__ = "insider_strategy_picks"

    id = Column(Integer, primary_key=True, index=True)
    pick_date = Column(Date, nullable=False, index=True)
    symbol = Column(String(50), nullable=False, index=True)

    # Price data
    entry_price = Column(Float, nullable=True)
    target_price = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    current_price = Column(Float, nullable=True)

    # Composite scoring (0-100)
    momentum_score = Column(Float, nullable=True)  # 40% weight
    volume_score = Column(Float, nullable=True)    # 30% weight
    oi_score = Column(Float, nullable=True)        # 30% weight
    composite_score = Column(Float, nullable=True) # Final score
    grade = Column(String(1), nullable=True)       # A, B, C, D

    # Pattern detection
    pattern_detected = Column(String(100), nullable=True)  # Cup&Handle, Flag, Triangle, etc.
    pattern_confidence = Column(Float, nullable=True)      # 0-100%

    # Metrics
    price_change_pct = Column(Float, nullable=True)
    volume_ratio = Column(Float, nullable=True)  # Current vs avg volume
    oi_change_pct = Column(Float, nullable=True)
    rsi = Column(Float, nullable=True)

    # Status tracking
    status = Column(String(20), nullable=True)  # ACTIVE, HIT_TARGET, HIT_SL, EXPIRED
    pick_type = Column(String(20), nullable=True)  # BULLISH, BEARISH

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    expired_at = Column(DateTime, nullable=True)


class InsiderStrategyPerformance(Base):
    """
    Historical performance tracking for Insider Strategy picks.
    Tracks hit rate, avg returns, and strategy effectiveness.
    """
    __tablename__ = "insider_strategy_performance"

    id = Column(Integer, primary_key=True, index=True)
    pick_id = Column(Integer, ForeignKey("insider_strategy_picks.id"), nullable=False, index=True)

    # Entry/Exit tracking
    entry_date = Column(Date, nullable=False)
    exit_date = Column(Date, nullable=True)
    entry_price = Column(Float, nullable=False)
    exit_price = Column(Float, nullable=True)

    # Performance metrics
    return_pct = Column(Float, nullable=True)  # Actual return %
    days_held = Column(Integer, nullable=True)
    outcome = Column(String(20), nullable=True)  # TARGET_HIT, SL_HIT, EXPIRED, ACTIVE

    # Accuracy tracking
    predicted_move_pct = Column(Float, nullable=True)  # Expected move
    actual_move_pct = Column(Float, nullable=True)     # Actual move
    prediction_accuracy = Column(Float, nullable=True) # How close was prediction

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ==================== Option Apex Tables ====================

class OptionApexCandle(Base):
    """
    Real-time option candle data with per-candle OI and Volume tracking.
    Supports multiple timeframes: 1m, 5m, 15m, 30m.
    """
    __tablename__ = "option_apex_candles"

    id = Column(Integer, primary_key=True, index=True)

    # Option identification
    symbol = Column(String(100), nullable=False, index=True)  # e.g., NIFTY24JAN24000CE
    underlying = Column(String(50), nullable=False, index=True)  # NIFTY, BANKNIFTY
    strike = Column(Float, nullable=False)
    option_type = Column(String(2), nullable=False)  # CE or PE
    expiry_date = Column(Date, nullable=False, index=True)

    # Candle data
    timeframe = Column(String(10), nullable=False, index=True)  # 1m, 5m, 15m, 30m
    candle_time = Column(DateTime, nullable=False, index=True)
    open_price = Column(Float, nullable=True)
    high_price = Column(Float, nullable=True)
    low_price = Column(Float, nullable=True)
    close_price = Column(Float, nullable=True)

    # Volume and OI tracking (per candle)
    volume = Column(Float, nullable=True)
    open_interest = Column(Float, nullable=True)
    oi_change = Column(Float, nullable=True)  # Change from previous candle
    oi_change_pct = Column(Float, nullable=True)

    # Implied Volatility
    iv = Column(Float, nullable=True)  # Implied Volatility
    iv_change = Column(Float, nullable=True)  # Change from previous candle

    # Institutional flow indicators
    buyer_qty = Column(Float, nullable=True)  # Aggressive buying
    seller_qty = Column(Float, nullable=True)  # Aggressive selling
    net_flow = Column(Float, nullable=True)  # buyer_qty - seller_qty

    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)


class OptionApexSignal(Base):
    """
    Entry/Exit signals generated from Option Apex candle analysis.
    Based on OI buildup, volume spikes, and IV changes.
    """
    __tablename__ = "option_apex_signals"

    id = Column(Integer, primary_key=True, index=True)
    signal_time = Column(DateTime, nullable=False, index=True)

    # Option identification
    symbol = Column(String(100), nullable=False, index=True)
    underlying = Column(String(50), nullable=False, index=True)
    strike = Column(Float, nullable=False)
    option_type = Column(String(2), nullable=False)  # CE or PE
    expiry_date = Column(Date, nullable=False)

    # Signal details
    signal_type = Column(String(20), nullable=False)  # ENTRY, EXIT, HOLD
    direction = Column(String(10), nullable=False)  # BULLISH, BEARISH, NEUTRAL
    strength = Column(String(20), nullable=False)  # STRONG, MODERATE, WEAK

    # Signal reasons (what triggered it)
    trigger_reason = Column(Text, nullable=True)  # "OI buildup + Volume spike"
    confidence_score = Column(Float, nullable=True)  # 0-100

    # Price and levels
    entry_price = Column(Float, nullable=True)
    target_price = Column(Float, nullable=True)
    stop_loss = Column(Float, nullable=True)
    current_price = Column(Float, nullable=True)

    # Signal context
    oi_at_signal = Column(Float, nullable=True)
    volume_at_signal = Column(Float, nullable=True)
    iv_at_signal = Column(Float, nullable=True)

    # Status
    status = Column(String(20), nullable=True)  # ACTIVE, HIT_TARGET, HIT_SL, EXPIRED

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class OptionApexIVHistory(Base):
    """
    Historical Implied Volatility tracking for options.
    Helps identify IV expansion/contraction patterns.
    """
    __tablename__ = "option_apex_iv_history"

    id = Column(Integer, primary_key=True, index=True)

    # Option identification
    symbol = Column(String(100), nullable=False, index=True)
    underlying = Column(String(50), nullable=False, index=True)
    strike = Column(Float, nullable=False)
    option_type = Column(String(2), nullable=False)
    expiry_date = Column(Date, nullable=False, index=True)

    # IV data
    snapshot_time = Column(DateTime, nullable=False, index=True)
    iv_value = Column(Float, nullable=False)
    iv_percentile = Column(Float, nullable=True)  # Where current IV sits vs historical (0-100)

    # Context
    underlying_price = Column(Float, nullable=True)
    option_price = Column(Float, nullable=True)
    days_to_expiry = Column(Integer, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
