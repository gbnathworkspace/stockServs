"""
One-time script to initialize database tables on Render
Visit: https://stockservs.onrender.com/setup-database
"""
from database.connection import engine, Base
from database.models import User, ZerodhaToken

def setup_database():
    try:
        Base.metadata.create_all(bind=engine)
        return {"status": "success", "message": "Database tables created successfully!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    result = setup_database()
    print(result)
