from database.connection import engine, Base
from database.models import User, ZerodhaToken
import os

print("=" * 50)
print("DATABASE SETUP")
print("=" * 50)

# Check database URL
db_url = os.getenv("DATABASE_URL")
print(f"Database URL: {db_url[:30]}..." if db_url else "ERROR: No DATABASE_URL found!")

print("\nAttempting to connect...")
try:
    # Test connection
    with engine.connect() as conn:
        print("✓ Connection successful!")

    print("\nCreating database tables...")
    Base.metadata.create_all(bind=engine)
    print("✓ Tables created successfully!")

    # Verify tables were created
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"\nTables in database: {tables}")

except Exception as e:
    print(f"\n✗ ERROR: {e}")
    import traceback
    traceback.print_exc()

print("=" * 50)