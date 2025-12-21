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
