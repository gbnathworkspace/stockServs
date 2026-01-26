"""
Script to fetch last 100 database-related exceptions from error_logs table

This script queries the error_logs table to retrieve the most recent
database-related errors, helping diagnose issues like the current
'is_default column not found' error.
"""

import os
import psycopg2
from dotenv import load_dotenv
from datetime import datetime

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in .env file")
    exit(1)

print("Connecting to database...\n")

try:
    # Connect to PostgreSQL
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    # Query last 100 database-related errors
    query = """
        SELECT 
            id,
            endpoint,
            method,
            status_code,
            error_type,
            error_message,
            created_at
        FROM error_logs
        WHERE 
            error_type LIKE '%SQL%' 
            OR error_type LIKE '%Database%'
            OR error_type LIKE '%Operational%'
            OR error_message LIKE '%column%'
            OR error_message LIKE '%table%'
            OR error_message LIKE '%database%'
        ORDER BY created_at DESC
        LIMIT 100;
    """
    
    cursor.execute(query)
    errors = cursor.fetchall()
    
    if not errors:
        print("✓ No database-related errors found in the last 100 entries!")
        print("  This is a good sign - your database is healthy.")
    else:
        print(f"Found {len(errors)} database-related errors:\n")
        print("=" * 120)
        
        for error in errors:
            error_id, endpoint, method, status_code, error_type, error_message, created_at = error
            
            # Format timestamp
            timestamp = created_at.strftime("%Y-%m-%d %H:%M:%S") if created_at else "Unknown"
            
            # Truncate long error messages
            message_preview = error_message[:100] + "..." if error_message and len(error_message) > 100 else error_message
            
            print(f"ID: {error_id}")
            print(f"Time: {timestamp}")
            print(f"Endpoint: {method} {endpoint}")
            print(f"Status: {status_code}")
            print(f"Type: {error_type}")
            print(f"Message: {message_preview}")
            print("-" * 120)
        
        # Show summary by error type
        print("\n" + "=" * 120)
        print("SUMMARY BY ERROR TYPE:")
        print("=" * 120)
        
        cursor.execute("""
            SELECT 
                error_type,
                COUNT(*) as count,
                MAX(created_at) as last_occurrence
            FROM error_logs
            WHERE 
                error_type LIKE '%SQL%' 
                OR error_type LIKE '%Database%'
                OR error_type LIKE '%Operational%'
                OR error_message LIKE '%column%'
            GROUP BY error_type
            ORDER BY count DESC
            LIMIT 10;
        """)
        
        summary = cursor.fetchall()
        for error_type, count, last_seen in summary:
            last_seen_str = last_seen.strftime("%Y-%m-%d %H:%M:%S") if last_seen else "Unknown"
            print(f"{error_type:40} | Count: {count:4} | Last seen: {last_seen_str}")
        
        # Show most common error messages
        print("\n" + "=" * 120)
        print("MOST COMMON ERROR MESSAGES:")
        print("=" * 120)
        
        cursor.execute("""
            SELECT 
                LEFT(error_message, 80) as message_preview,
                COUNT(*) as count
            FROM error_logs
            WHERE 
                error_type LIKE '%SQL%' 
                OR error_type LIKE '%Database%'
                OR error_message LIKE '%column%'
            GROUP BY LEFT(error_message, 80)
            ORDER BY count DESC
            LIMIT 5;
        """)
        
        messages = cursor.fetchall()
        for msg, count in messages:
            print(f"[{count:3}x] {msg}")
    
    print("\n✅ Query completed successfully!")
    
except Exception as e:
    print(f"\n❌ Error fetching logs: {e}")
finally:
    if cursor:
        cursor.close()
    if conn:
        conn.close()
