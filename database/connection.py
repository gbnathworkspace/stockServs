from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from services.config_manager import get_database_url

# Get database URL (supports .env and AWS Parameter Store)
DATABASE_URL = get_database_url()

# Create the database engine with increased pool size for high-frequency requests
# pool_size: Number of permanent connections (default 5)
# max_overflow: Extra connections when pool is full (default 10)
# pool_pre_ping: Test connections before use to avoid stale connections
# pool_recycle: Recycle connections after 30 minutes to avoid timeouts
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
    pool_recycle=1800,
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