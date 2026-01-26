"""
Debug script to inspect Watchlist data
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
conn = psycopg2.connect(DATABASE_URL)
cursor = conn.cursor()

print("--- USERS ---")
cursor.execute("SELECT id, email FROM users")
for row in cursor.fetchall():
    print(f"User: {row}")

print("\n--- WATCHLISTS ---")
cursor.execute("SELECT id, user_id, name, is_default FROM watchlists")
for row in cursor.fetchall():
    print(f"Watchlist: {row}")

print("\n--- SPECIFIC CHECK FOR ID 2 ---")
cursor.execute("SELECT * FROM watchlists WHERE id = 2")
wl = cursor.fetchone()
if wl:
    print(f"Watchlist 2 found: {wl}")
else:
    print("Watchlist 2 NOT FOUND")

conn.close()
