from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from services.config_manager import get_database_url
import os
import logging

# Get database URL (supports .env and AWS Parameter Store)
DATABASE_URL = get_database_url()

# SQL Query Logging Configuration
# Set DEBUG_SQL=true in environment to enable SQL query logging
# Default: False (disabled) - safe for production
DEBUG_SQL = os.getenv("DEBUG_SQL", "false").lower() in ("true", "1", "yes")

if DEBUG_SQL:
    # Enable SQL query logging with detailed information
    logging.basicConfig(level=logging.INFO)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.INFO)
    print("[SQL DEBUG] SQL query logging ENABLED - All queries will be logged with values")
else:
    print("[SQL DEBUG] SQL query logging DISABLED - Set DEBUG_SQL=true to enable")

# Create the database engine with increased pool size for high-frequency requests
# pool_size: Number of permanent connections (default 5)
# max_overflow: Extra connections when pool is full (default 10)
# pool_pre_ping: Test connections before use to avoid stale connections
# pool_recycle: Recycle connections after 30 minutes to avoid timeouts
# echo: When True, logs all SQL statements
# echo_pool: When True, logs connection pool events
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=1800,
    echo=DEBUG_SQL,  # Log SQL queries when DEBUG_SQL=true
    echo_pool="debug" if DEBUG_SQL else False,  # Log pool events in debug mode
)


# Create a session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for all models
Base = declarative_base()

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()