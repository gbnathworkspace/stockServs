import asyncio
import sys
import os
import json

# Add current directory to path
sys.path.append(os.getcwd())

from nse_data.fno import fetch_nse_data

async def show_raw_market_map(symbol="NIFTY"):
    print(f"--- FETCHING RAW MARKET MAP FOR: {symbol} ---")
    
    # The actual NSE API for Indices
    url = f"https://www.nseindia.com/api/option-chain-indices?symbol={symbol}"
    
    try:
        # Using our newly updated fetch_nse_data which handles cookies/sessions
        raw_data = await fetch_nse_data(url, symbol)
        
        if not raw_data:
            print("Failed to fetch data. NSE might be blocking or market is closed.")
            return

        # Let's look at the structure
        print(f"\nAPI Keys Found: {list(raw_data.keys())}")
        
        records = raw_data.get("records", {})
        data_list = records.get("data", [])
        
        print(f"\n--- METADATA ---")
        print(f"Underlying Index: {records.get('index')}")
        print(f"Underlying Value: {records.get('underlyingValue')}")
        print(f"Timestamp: {records.get('timestamp')}")
        print(f"Total Expiries Available: {len(records.get('expiryDates', []))}")
        print(f"Total Strike Prices Available: {len(records.get('strikePrices', []))}")
        print(f"Total Raw Contract Rows: {len(data_list)}")

        # Show exactly what 2 rows look like (raw)
        print(f"\n--- SAMPLE RAW DATA (First 2 contract rows) ---")
        print(json.dumps(data_list[:2], indent=2))
        
        # Explain the structure
        print("\n--- STRUCTURE EXPLAINED ---")
        print("Each 'row' contains:")
        print("1. strikePrice: The price level")
        print("2. expiryDate: When the contract ends")
        print("3. CE object: All 'Call' data (LTP, OI, Volume, Greeks)")
        print("4. PE object: All 'Put' data (LTP, OI, Volume, Greeks)")
        
        # Save to a file for your inspection
        output_file = "raw_market_map_nifty.json"
        with open(output_file, "w") as f:
            json.dump(raw_data, f, indent=2)
        print(f"\nFULL RAW DATA SAVED TO: {os.path.abspath(output_file)}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(show_raw_market_map("NIFTY"))
