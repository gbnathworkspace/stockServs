from database.connection import engine, Base
from database.models import User, ZerodhaToken

print("Creating database tables...")
Base.metadata.create_all(bind=engine)
print("Tables created successfully!")