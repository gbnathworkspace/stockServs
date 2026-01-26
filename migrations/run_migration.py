"""
Database Migration Script - Add is_default column to watchlists

This script adds the is_default column to the watchlists table in PostgreSQL.
Run this to fix the 500 Internal Server Error.
"""

import os
import psycopg2
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("ERROR: DATABASE_URL not found in .env file")
    exit(1)

print(f"Connecting to database...")

try:
    # Connect to PostgreSQL
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    
    print("✓ Connected successfully")
    
    # Check if column already exists
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name='watchlists' AND column_name='is_default';
    """)
    
    if cursor.fetchone():
        print("⚠ Column 'is_default' already exists. Skipping migration.")
    else:
        print("Adding 'is_default' column...")
        
        # Add the column
        cursor.execute("""
            ALTER TABLE watchlists 
            ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0;
        """)
        
        print("✓ Column added successfully")
        
        # Optional: Mark first watchlist for each user as default
        print("Marking first watchlist for each user as default...")
        cursor.execute("""
            UPDATE watchlists w1
            SET is_default = 1
            WHERE id IN (
                SELECT MIN(id) 
                FROM watchlists 
                GROUP BY user_id
            );
        """)
        
        rows_updated = cursor.rowcount
        print(f"✓ Marked {rows_updated} watchlists as default")
    
    # Commit changes
    conn.commit()
    
    # Verify migration
    print("\nVerifying migration...")
    cursor.execute("SELECT id, user_id, name, is_default FROM watchlists LIMIT 5;")
    results = cursor.fetchall()
    
    print("\nSample data:")
    print("ID | User ID | Name | Is Default")
    print("-" * 40)
    for row in results:
        print(f"{row[0]} | {row[1]} | {row[2]} | {row[3]}")
    
    print("\n✅ Migration completed successfully!")
    
except Exception as e:
    print(f"\n❌ Migration failed: {e}")
    if conn:
        conn.rollback()
finally:
    if cursor:
        cursor.close()
    if conn:
        conn.close()
