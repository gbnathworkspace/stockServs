#!/usr/bin/env python3
"""
Fyers Token Validation Script
Checks if a valid Fyers access token exists in the database.
Used during startup to ensure market data APIs will work.

Exit Codes:
  0 - Valid token exists
  1 - No token or expired token
  2 - Error (database connection, etc.)
"""
import sys
import os
from datetime import datetime, timedelta

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def check_token_status():
    """Check Fyers token status in database."""
    try:
        from database.connection import SessionLocal
        from database.models import FyersToken
    except Exception as e:
        print(f"❌ Failed to import database modules: {e}")
        print("   Make sure dependencies are installed: pip install -r requirements.txt")
        return 2

    db = SessionLocal()
    try:
        # Get most recent token
        token = db.query(FyersToken).order_by(FyersToken.created_at.desc()).first()

        if not token:
            print("❌ No Fyers token found in database")
            print("\n" + "="*60)
            print("⚠️  MARKET DATA WARNING")
            print("="*60)
            print("\nWithout a Fyers token, the system will:")
            print("  • Fall back to NSE India API (unreliable)")
            print("  • Show ₹0.00 prices outside market hours")
            print("  • Experience 403 errors due to anti-scraping")
            print("\n📋 TO FIX:")
            print("  1. Start the backend server")
            print("  2. Login to the app as admin")
            print("  3. Go to Settings → Profile")
            print("  4. Click 'Connect Fyers'")
            print("  5. Complete OAuth flow")
            print("\n✅ Once connected, ALL users will automatically get live data")
            print("="*60 + "\n")
            return 1

        # Check if token has access_token
        if not token.access_token:
            print("❌ Token exists but has no access_token")
            return 1

        # Check expiry
        if token.expires_at:
            time_until_expiry = token.expires_at - datetime.now()

            if time_until_expiry.total_seconds() <= 0:
                print("❌ Fyers token has EXPIRED")
                print(f"   Expired: {token.expires_at}")
                print(f"   User ID: {token.user_id}")
                print("\n📋 TO FIX: Reconnect Fyers in Settings → Profile")
                return 1

            # Warn if expiring soon (within 2 hours)
            if time_until_expiry < timedelta(hours=2):
                hours = int(time_until_expiry.total_seconds() / 3600)
                minutes = int((time_until_expiry.total_seconds() % 3600) / 60)
                print(f"⚠️  Fyers token expiring soon: {hours}h {minutes}m remaining")
                print(f"   User ID: {token.user_id}")
                print(f"   Expires: {token.expires_at}")
                print("\n💡 Consider reconnecting Fyers to avoid interruption")
                # Still return 0 since token is technically valid
                return 0

        # Token is valid
        print("✅ Valid Fyers token found")
        print(f"   User ID: {token.user_id}")
        print(f"   Created: {token.created_at}")
        if token.expires_at:
            time_until_expiry = token.expires_at - datetime.now()
            hours = int(time_until_expiry.total_seconds() / 3600)
            print(f"   Expires: {token.expires_at} ({hours}h remaining)")
        else:
            print(f"   Expires: No expiry set")
        print(f"   Token: {token.access_token[:20]}...")
        print("\n🟢 Market data will use Fyers API (reliable)")
        print("✅ All users will see live stock prices")
        return 0

    except Exception as e:
        print(f"❌ Database error: {e}")
        print("\nCheck:")
        print("  • DATABASE_URL is configured in .env")
        print("  • Database is accessible")
        print("  • Migrations have been run")
        return 2
    finally:
        db.close()


def main():
    """Main entry point."""
    exit_code = check_token_status()
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
