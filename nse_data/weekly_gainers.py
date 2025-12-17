"""
Weekly Historical Gainers/Losers using yfinance
Fetches historical data for NIFTY 100 stocks and calculates daily top gainers/losers
"""

import yfinance as yf
from datetime import datetime, timedelta
from typing import Dict, List, Any
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed
import httpx

NIFTY_100_STOCKS = [
    "ABB", "ACC", "ADANIENSOL", "ADANIENT", "ADANIGREEN", "ADANIPORTS",
    "ADANIPOWER", "ATGL", "AMBUJACEM", "APOLLOHOSP", "ASIANPAINT", "DMART",
    "AXISBANK", "BAJAJ-AUTO", "BAJFINANCE", "BAJAJFINSV", "BAJAJHLDNG",
    "BALKRISIND", "BANDHANBNK", "BANKBARODA", "BANKINDIA", "BEL", "BERGEPAINT",
    "BHARATFORG", "BHARTIARTL", "BHEL", "BIOCON", "BOSCHLTD", "BPCL",
    "BRITANNIA", "CANBK", "CHOLAFIN", "CIPLA", "COALINDIA", "COFORGE",
    "COLPAL", "CONCOR", "DLF", "DABUR", "DIVISLAB", "DRREDDY", "EICHERMOT",
    "GAIL", "GICRE", "GODREJCP", "GODREJPROP", "GRASIM", "HCLTECH",
    "HDFCAMC", "HDFCBANK", "HDFCLIFE", "HAVELLS", "HEROMOTOCO", "HINDALCO",
    "HAL", "HINDUNILVR", "ICICIBANK", "ICICIGI", "ICICIPRULI", "ITC",
    "IOC", "IRCTC", "IRFC", "INDHOTEL", "INDUSINDBK", "INDUSTOWER", "INFY",
    "INDIGO", "JSWSTEEL", "JINDALSTEL", "JIOFIN", "KOTAKBANK", "LTIM", "LT",
    "LTTS", "LICI", "LUPIN", "M&M", "MARICO", "MARUTI", "MFSL", "MPHASIS",
    "MUTHOOTFIN", "NAUKRI", "NESTLEIND", "NTPC", "NHPC", "NMDC", "ONGC",
    "OIL", "PIIND", "PAGEIND", "PATANJALI", "PERSISTENT", "PETRONET", "PIDILITIND",
    "POONAWALLA", "PFC", "POWERGRID", "PRESTIGE", "PGHH", "PNB", "RECLTD",
    "RELIANCE", "SBICARD", "SBILIFE", "SRF", "MOTHERSON", "SHREECEM", "SHRIRAMFIN",
    "SIEMENS", "SOLARINDS", "SBIN", "SUNPHARMA", "SUZLON", "TVSMOTOR",
    "TATACHEM", "TATACOMM", "TCS", "TATACONSUM", "TATAELXSI", "TATAMOTORS",
    "TATAPOWER", "TATASTEEL", "TECHM", "TITAN", "TORNTPHARM", "TRENT",
    "TIINDIA", "ULTRACEMCO", "UNIONBANK", "UPL", "VBL", "VEDL", "WIPRO",
    "ZOMATO", "ZYDUSLIFE"
]

def fetch_nse_index_constituents(index: str = "NIFTY 100") -> List[Dict[str, Any]]:
    """
    Fetch live constituents data from NSE's stock indices API.

    This provides LTP-based fields like `lastPrice` and `pChange`, which can differ
    from official EOD `close` after the market closes.
    """
    url = f"https://www.nseindia.com/api/equity-stockIndices?index={index.replace(' ', '%20')}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.nseindia.com/",
    }

    try:
        with httpx.Client(follow_redirects=True, timeout=20) as client:
            try:
                client.get("https://www.nseindia.com", headers=headers)
            except Exception:
                pass
            resp = client.get(url, headers=headers)
            resp.raise_for_status()
            payload = resp.json()
            return payload.get("data", []) or []
    except Exception as e:
        print(f"Error fetching NSE index data ({index}): {e}")
        return []


def get_stock_history(symbol: str, period: str = "7d") -> pd.DataFrame:
    """Fetch historical data for a single stock"""
    try:
        ticker = yf.Ticker(f"{symbol}.NS")
        hist = ticker.history(period=period)
        if hist.empty:
            return pd.DataFrame()
        hist['Symbol'] = symbol
        return hist
    except Exception as e:
        print(f"Error fetching {symbol}: {e}")
        return pd.DataFrame()


def calculate_daily_changes(hist: pd.DataFrame) -> pd.DataFrame:
    """Calculate daily percentage changes"""
    if hist.empty:
        return pd.DataFrame()
    
    hist['PrevClose'] = hist['Close'].shift(1)
    hist['Change'] = hist['Close'] - hist['PrevClose']
    hist['ChangePercent'] = ((hist['Close'] - hist['PrevClose']) / hist['PrevClose']) * 100
    return hist.dropna()


def get_weekly_gainers_losers(num_days: int = 5) -> Dict[str, Any]:
    """
    Get weekly top gainers and losers for NIFTY 100 stocks
    Returns data for each trading day with top 10 gainers and losers
    """
    all_data = []
    
    # Fetch data for all stocks in parallel
    with ThreadPoolExecutor(max_workers=10) as executor:
        future_to_symbol = {
            executor.submit(get_stock_history, symbol, "10d"): symbol 
            for symbol in NIFTY_100_STOCKS
        }
        
        for future in as_completed(future_to_symbol):
            symbol = future_to_symbol[future]
            try:
                hist = future.result()
                if not hist.empty:
                    hist_with_changes = calculate_daily_changes(hist)
                    if not hist_with_changes.empty:
                        all_data.append(hist_with_changes)
            except Exception as e:
                print(f"Error processing {symbol}: {e}")
    
    if not all_data:
        return {"error": "No data available", "weekly_data": []}
    
    # Combine all stock data - don't ignore index since it contains dates
    combined = pd.concat(all_data)
    combined = combined.reset_index()
    # yfinance uses 'Date' or 'Datetime' as the index name after reset
    if 'index' in combined.columns:
        combined = combined.rename(columns={'index': 'Date'})
    combined['Date'] = pd.to_datetime(combined['Date']).dt.date

    # Override the latest day with NSE LTP-based values (lastPrice/pChange) so
    # "today" matches NSE's live calculations.
    if not combined.empty:
        latest_date = combined['Date'].max()
        nse_rows = fetch_nse_index_constituents("NIFTY 100")
        if nse_rows:
            ltp_by_symbol = {}
            for row in nse_rows:
                symbol = row.get("symbol")
                last_price = row.get("lastPrice")
                p_change = row.get("pChange")
                if symbol and last_price is not None and p_change is not None:
                    try:
                        ltp_by_symbol[str(symbol)] = (float(last_price), float(p_change))
                    except Exception:
                        continue

            if ltp_by_symbol:
                mask = combined['Date'].eq(latest_date) & combined['Symbol'].isin(ltp_by_symbol.keys())
                if mask.any():
                    combined.loc[mask, 'Close'] = combined.loc[mask, 'Symbol'].map(lambda s: ltp_by_symbol[s][0])
                    combined.loc[mask, 'ChangePercent'] = combined.loc[mask, 'Symbol'].map(lambda s: ltp_by_symbol[s][1])

    
    # Group by date and get top gainers/losers
    weekly_data = []
    unique_dates = sorted(combined['Date'].unique(), reverse=True)[:num_days]
    
    for date in unique_dates:
        day_data = combined[combined['Date'] == date]
        
        # Sort by change percentage
        sorted_data = day_data.sort_values('ChangePercent', ascending=False)
        
        # Top 10 gainers
        top_gainers = sorted_data.head(10)[['Symbol', 'Close', 'ChangePercent']].to_dict('records')
        for g in top_gainers:
            g['lastPrice'] = round(g.pop('Close'), 2)
            g['pChange'] = round(g.pop('ChangePercent'), 2)
            g['symbol'] = g.pop('Symbol')
        
        # Top 10 losers
        top_losers = sorted_data.tail(10)[['Symbol', 'Close', 'ChangePercent']].to_dict('records')
        top_losers = sorted(top_losers, key=lambda x: x['ChangePercent'])  # Sort ascending (worst first)
        for l in top_losers:
            l['lastPrice'] = round(l.pop('Close'), 2)
            l['pChange'] = round(l.pop('ChangePercent'), 2)
            l['symbol'] = l.pop('Symbol')
        
        # Get day name
        date_obj = datetime.combine(date, datetime.min.time())
        day_name = date_obj.strftime('%a')  # Mon, Tue, etc.
        
        weekly_data.append({
            "date": str(date),
            "dayName": day_name,
            "topGainers": top_gainers,
            "topLosers": top_losers
        })
    
    return {
        "lastUpdated": datetime.now().isoformat(),
        "weeklyData": weekly_data
    }


# Quick test
if __name__ == "__main__":
    import json
    result = get_weekly_gainers_losers(5)
    print(json.dumps(result, indent=2))
