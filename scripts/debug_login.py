"""
Login Debug Script
------------------
This script helps debug login issues by checking database credentials.

Usage:
  python scripts/debug_login.py                    # List all users
  python scripts/debug_login.py test@example.com   # Check specific user
"""
from database.connection import SessionLocal
from database.models import LocalCredential, User
from routes.auth import verify_password
import sys

def check_login(email=None):
    """Check login credentials for a user"""
    db = SessionLocal()
    
    try:
        if email:
            cred = db.query(LocalCredential).filter(LocalCredential.email == email).first()
            if not cred:
                print(f"❌ No user found with email: {email}")
                return False
            
            print(f"✅ User found: {cred.email}")
            print(f"   User ID: {cred.user_id}")
            print(f"   Has password hash: {bool(cred.password_hash)}")
            print(f"   Has Google auth: {bool(cred.google_sub)}")
            
            if cred.password_hash:
                # Test common passwords
                test_passwords = ["password", "test", "test123", "Test@123", "admin", "admin123"]
                print(f"\nTesting common passwords...")
                for pwd in test_passwords:
                    if verify_password(pwd, cred.password_hash):
                        print(f"✅ PASSWORD MATCH: '{pwd}'")
                        return True
                
                print("❌ None of the common passwords match")
                print("   You'll need to:")
                print("   1. Remember your actual password, or")
                print("   2. Sign up with a new account")
            
        else:
            # List all users
            all_creds = db.query(LocalCredential).all()
            if not all_creds:
                print("❌ No users found in database")
                print("   Create an account by signing up at: http://localhost:5173/signup")
                return False
            
            print(f"📋 Total users in database: {len(all_creds)}\n")
            for i, cred in enumerate(all_creds, 1):
                user = db.query(User).filter(User.id == cred.user_id).first()
                print(f"{i}. Email: {cred.email}")
                print(f"   User ID: {user.id if user else 'N/A'}")
                print(f"   Has password: {bool(cred.password_hash)}")
                print(f"   Has Google: {bool(cred.google_sub)}")
                print()
        
    finally:
        db.close()
    
    return False


if __name__ == "__main__":
    if len(sys.argv) > 1:
        email = sys.argv[1]
        check_login(email)
    else:
        print("=" * 60)
        print("Login Debug Tool")
        print("=" * 60)
        check_login()
        print("\n💡 To check a specific user: python scripts/debug_login.py email@example.com")
