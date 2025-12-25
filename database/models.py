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
