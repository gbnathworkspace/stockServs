import asyncio
import sys
import os

# Add current directory to path
sys.path.append(os.getcwd())

from nse_data.fno import fetch_nse_data, INDEX_FO_SYMBOLS, POPULAR_STOCK_FO

async def main():
    print("Directly fetching data from NSE to verify logic...")
    
    # 1. Test fetch_nse_data with NIFTY option chain (as a proxy for F&O availability)
    symbol = "NIFTY"
    url = f"https://www.nseindia.com/api/option-chain-indices?symbol={symbol}"
    
    print(f"Fetching {symbol} option chain from: {url}")
    try:
        data = await fetch_nse_data(url, symbol)
        if data:
            records = data.get("records", {})
            underlying = records.get("underlyingValue", "Unknown")
            expiries = records.get("expiryDates", [])[:3]
            print(f"  SUCCESS!")
            print(f"  Underlying: {underlying}")
            print(f"  Available Expiries (first 3): {expiries}")
            
            # Check for a specific strike in records
            all_data = records.get("data", [])
            print(f"  Total contracts in chain: {len(all_data)}")
            
            # Sample some strikes
            strikes = [item.get("strikePrice") for item in all_data[:5]]
            print(f"  Sample strikes: {strikes}")
        else:
            print("  FAILED: No data returned")
    except Exception as e:
        print(f"  ERROR: {e}")

    # 2. Test a stock search
    symbol = "RELIANCE"
    url = f"https://www.nseindia.com/api/option-chain-equities?symbol={symbol}"
    print(f"\nFetching {symbol} equity F&O from: {url}")
    try:
        data = await fetch_nse_data(url, symbol)
        if data:
            records = data.get("records", {})
            print(f"  SUCCESS! Found F&O data for {symbol}")
        else:
            print("  FAILED: No data returned")
    except Exception as e:
        print(f"  ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(main())
