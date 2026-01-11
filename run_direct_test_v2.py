import asyncio
import sys
import os
import traceback

# Add current directory to path
sys.path.append(os.getcwd())

from nse_data.fno import fetch_nse_data

async def test_symbol(symbol, is_index=True):
    if is_index:
        url = f"https://www.nseindia.com/api/option-chain-indices?symbol={symbol}"
    else:
        url = f"https://www.nseindia.com/api/option-chain-equities?symbol={symbol}"
        
    print(f"\n--- Testing Symbol: {symbol} ---")
    print(f"URL: {url}")
    
    try:
        data = await fetch_nse_data(url, symbol)
        if data:
            print(f"  SUCCESS! Keys found: {list(data.keys())}")
            if "records" in data:
                print(f"  Underlying Value: {data['records'].get('underlyingValue')}")
                print(f"  Expiry Dates: {data['records'].get('expiryDates', [])[:2]}")
        else:
            print(f"  FAILED: Returned data is empty or False: {data}")
    except Exception as e:
        print(f"  CAUGHT EXCEPTION: {type(e).__name__}: {e}")
        traceback.print_exc()

async def main():
    print("Direct NSE Data Fetch Test")
    await test_symbol("NIFTY", True)
    await test_symbol("RELIANCE", False)

if __name__ == "__main__":
    asyncio.run(main())
