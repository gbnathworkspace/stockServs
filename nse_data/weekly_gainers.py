"""
Weekly Historical Gainers/Losers using yfinance
Fetches historical data for NIFTY 100 stocks and calculates daily top gainers/losers
"""

import yfinance as yf
from datetime import datetime, timedelta
from typing import Dict, List, Any
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed

# NIFTY 100 stocks list (NSE symbols)
NIFTY_100_STOCKS = [
    "RELIANCE", "TCS", "HDFCBANK", "INFY", "ICICIBANK", "HINDUNILVR", "SBIN", 
    "BHARTIARTL", "ITC", "KOTAKBANK", "LT", "AXISBANK", "ASIANPAINT", "MARUTI",
    "HCLTECH", "SUNPHARMA", "BAJFINANCE", "TITAN", "ULTRACEMCO", "WIPRO",
    "NESTLEIND", "ONGC", "NTPC", "POWERGRID", "TATASTEEL", "JSWSTEEL", "M&M",
    "TATAMOTORS", "ADANIENT", "ADANIPORTS", "BAJAJFINSV", "TECHM", "GRASIM",
    "INDUSINDBK", "HINDALCO", "DIVISLAB", "DRREDDY", "CIPLA", "EICHERMOT",
    "COALINDIA", "BPCL", "BRITANNIA", "HEROMOTOCO", "SHREECEM", "DABUR",
    "APOLLOHOSP", "BAJAJ-AUTO", "PIDILITIND", "SBILIFE", "SIEMENS",
    "HDFCLIFE", "TATACONSUM", "GODREJCP", "ICICIPRULI", "HAVELLS", "BANKBARODA",
    "INDIGO", "AMBUJACEM", "DLF", "VEDL", "GAIL", "IOC", "HINDPETRO",
    "PNB", "CANBK", "LUPIN", "TATAPOWER", "TORNTPHARM", "ZOMATO", "PAYTM",
    "DMART", "NYKAA", "POLICYBZR", "ADANIGREEN", "ADANITRANS", "ADANIPOWER",
    "ATGL", "AWL", "LODHA", "LICI", "HDFCAMC", "ICICIGI", "MUTHOOTFIN",
    "CHOLAFIN", "BAJAJHLDNG", "MARICO", "BERGEPAINT", "COLPAL", "PGHH",
    "INDHOTEL", "LTIM", "PERSISTENT", "COFORGE", "MPHASIS", "LTTS",
    "TRENT", "PAGEIND", "PIIND", "SRF", "AUROPHARMA", "BIOCON"
]


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
