"""
NSE Futures & Options (F&O) Data Module

Provides endpoints for:
- Option chains (NIFTY, BANKNIFTY, stock options)
- Futures data
- OI (Open Interest) analysis
"""

from fastapi import APIRouter, HTTPException, Query
import httpx
import asyncio
from typing import Optional
from datetime import datetime

from services.cache import cache

router = APIRouter()

# NSE API endpoints
NSE_OPTION_CHAIN_INDICES = "https://www.nseindia.com/api/option-chain-indices?symbol="
NSE_OPTION_CHAIN_EQUITIES = "https://www.nseindia.com/api/option-chain-equities?symbol="
NSE_FO_QUOTE = "https://www.nseindia.com/api/quote-derivative?symbol="

# Cache TTLs
TTL_OPTION_CHAIN = 30  # 30 seconds (option chain data changes frequently)
TTL_FO_QUOTE = 60  # 60 seconds

# Key F&O instruments
INDEX_FO_SYMBOLS = ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]
POPULAR_STOCK_FO = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN", "TATAMOTORS", "TATASTEEL", "AXISBANK", "BAJFINANCE"]


async def fetch_nse_data(url: str, symbol: str = ""):
    """Generic NSE data fetcher with proper headers and cookies."""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Referer": "https://www.nseindia.com/",
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=20.0) as client:
        try:
            # Get cookies from main page first
            try:
                await client.get("https://www.nseindia.com", headers=headers)
                await asyncio.sleep(0.3)
            except Exception:
                pass

            response = await client.get(url, headers=headers)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            print(f"HTTP error fetching {url}: {e.response.status_code}")
            raise HTTPException(status_code=e.response.status_code, detail=f"NSE API error: {e.response.status_code}")
        except Exception as e:
            print(f"Error fetching NSE data from {url}: {e}")
            raise HTTPException(status_code=500, detail=f"Failed to fetch data: {str(e)}")


def format_option_chain(data: dict) -> dict:
    """Format option chain data for frontend consumption."""
    records = data.get("records", {})
    filtered = data.get("filtered", {})
    
    # Extract key information
    expiry_dates = records.get("expiryDates", [])
    strike_prices = records.get("strikePrices", [])
    underlying_value = records.get("underlyingValue", 0)
    
    # Get current expiry (first one is usually nearest)
    current_expiry = expiry_dates[0] if expiry_dates else None
    
    # Process option chain data
    chain_data = []
    for item in records.get("data", []):
        ce = item.get("CE", {})
        pe = item.get("PE", {})
        strike = item.get("strikePrice", 0)
        
        chain_data.append({
            "strikePrice": strike,
            "expiryDate": item.get("expiryDate", ""),
            "CE": {
                "openInterest": ce.get("openInterest", 0),
                "changeinOpenInterest": ce.get("changeinOpenInterest", 0),
                "totalTradedVolume": ce.get("totalTradedVolume", 0),
                "impliedVolatility": ce.get("impliedVolatility", 0),
                "lastPrice": ce.get("lastPrice", 0),
                "change": ce.get("change", 0),
                "pChange": ce.get("pChange", 0),
                "bidQty": ce.get("bidQty", 0),
                "bidprice": ce.get("bidprice", 0),
                "askQty": ce.get("askQty", 0),
                "askPrice": ce.get("askPrice", 0),
            } if ce else None,
            "PE": {
                "openInterest": pe.get("openInterest", 0),
                "changeinOpenInterest": pe.get("changeinOpenInterest", 0),
                "totalTradedVolume": pe.get("totalTradedVolume", 0),
                "impliedVolatility": pe.get("impliedVolatility", 0),
                "lastPrice": pe.get("lastPrice", 0),
                "change": pe.get("change", 0),
                "pChange": pe.get("pChange", 0),
                "bidQty": pe.get("bidQty", 0),
                "bidprice": pe.get("bidprice", 0),
                "askQty": pe.get("askQty", 0),
                "askPrice": pe.get("askPrice", 0),
            } if pe else None,
        })
    
    # Aggregate totals
    totals = {
        "CE": {
            "totalOI": filtered.get("CE", {}).get("totOI", 0),
            "totalVolume": filtered.get("CE", {}).get("totVol", 0),
        },
        "PE": {
            "totalOI": filtered.get("PE", {}).get("totOI", 0),
            "totalVolume": filtered.get("PE", {}).get("totVol", 0),
        }
    }
    
    # Calculate PCR (Put-Call Ratio)
    total_ce_oi = totals["CE"]["totalOI"]
    total_pe_oi = totals["PE"]["totalOI"]
    pcr = round(total_pe_oi / total_ce_oi, 2) if total_ce_oi > 0 else 0
    
    return {
        "symbol": data.get("records", {}).get("index", ""),
        "underlyingValue": underlying_value,
        "expiryDates": expiry_dates,
        "currentExpiry": current_expiry,
        "strikePrices": strike_prices,
        "data": chain_data,
        "totals": totals,
        "pcr": pcr,
        "timestamp": datetime.now().isoformat(),
    }


@router.get("/option-chain/{symbol}")
async def get_option_chain(
    symbol: str,
    expiry: Optional[str] = Query(None, description="Expiry date (YYYY-MM-DD)")
):
    """
    Get option chain data for an index or stock.
    
    Supported indices: NIFTY, BANKNIFTY, FINNIFTY, MIDCPNIFTY
    Supported stocks: Any F&O enabled stock (e.g., RELIANCE, TCS, INFY)
    """
    symbol = symbol.upper().strip()
    
    # Check cache
    cache_key = f"option_chain:{symbol}:{expiry or 'current'}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    # Determine if index or equity
    if symbol in INDEX_FO_SYMBOLS:
        url = f"{NSE_OPTION_CHAIN_INDICES}{symbol}"
    else:
        url = f"{NSE_OPTION_CHAIN_EQUITIES}{symbol}"
    
    try:
        data = await fetch_nse_data(url, symbol)
        
        # Filter by expiry if specified
        if expiry and data.get("records", {}).get("data"):
            data["records"]["data"] = [
                item for item in data["records"]["data"]
                if item.get("expiryDate") == expiry
            ]
        
        result = format_option_chain(data)
        cache.set(cache_key, result, TTL_OPTION_CHAIN)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch option chain: {str(e)}")


@router.get("/fo-quote/{symbol}")
async def get_fo_quote(symbol: str):
    """
    Get futures and options quote for a symbol.
    Returns all active contracts (futures and options) for the symbol.
    """
    symbol = symbol.upper().strip()
    
    # Check cache
    cache_key = f"fo_quote:{symbol}"
    cached = cache.get(cache_key)
    if cached:
        return cached
    
    url = f"{NSE_FO_QUOTE}{symbol}"
    
    try:
        data = await fetch_nse_data(url, symbol)
        
        # Extract futures data
        futures = []
        options_calls = []
        options_puts = []
        
        stocks = data.get("stocks", [])
        for stock in stocks:
            metadata = stock.get("metadata", {})
            market_data = stock.get("marketDeptOrderBook", {}).get("tradeInfo", {})
            
            instrument_type = metadata.get("instrumentType", "")
            
            contract = {
                "identifier": metadata.get("identifier", ""),
                "expiryDate": metadata.get("expiryDate", ""),
                "strikePrice": metadata.get("strikePrice", 0),
                "lastPrice": metadata.get("lastPrice", 0),
                "change": metadata.get("change", 0),
                "pChange": metadata.get("pChange", 0),
                "openInterest": metadata.get("openInterest", 0),
                "changeinOpenInterest": metadata.get("changeinOpenInterest", 0),
                "tradedVolume": market_data.get("tradedVolume", 0),
                "value": market_data.get("value", 0),
            }
            
            if instrument_type == "Stock Futures" or instrument_type == "Index Futures":
                futures.append(contract)
            elif instrument_type == "Stock Options" or instrument_type == "Index Options":
                option_type = metadata.get("optionType", "")
                if option_type == "Call":
                    options_calls.append(contract)
                elif option_type == "Put":
                    options_puts.append(contract)
        
        # Sort by expiry
        futures.sort(key=lambda x: x.get("expiryDate", ""))
        options_calls.sort(key=lambda x: (x.get("expiryDate", ""), x.get("strikePrice", 0)))
        options_puts.sort(key=lambda x: (x.get("expiryDate", ""), x.get("strikePrice", 0)))
        
        result = {
            "symbol": symbol,
            "underlyingValue": data.get("underlyingValue", 0),
            "futures": futures,
            "options": {
                "calls": options_calls,
                "puts": options_puts,
            },
            "timestamp": datetime.now().isoformat(),
        }
        
        cache.set(cache_key, result, TTL_FO_QUOTE)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch F&O quote: {str(e)}")


@router.get("/fo-symbols")
async def get_fo_symbols():
    """
    Get list of available F&O symbols.
    Returns indices and popular stocks with F&O enabled.
    """
    return {
        "indices": INDEX_FO_SYMBOLS,
        "popular_stocks": POPULAR_STOCK_FO,
        "description": {
            "NIFTY": "NIFTY 50 Index Options & Futures",
            "BANKNIFTY": "Bank NIFTY Index Options & Futures",
            "FINNIFTY": "NIFTY Financial Services Index Options & Futures",
            "MIDCPNIFTY": "NIFTY Midcap Select Index Options & Futures",
        }
    }


@router.get("/oi-analysis/{symbol}")
async def get_oi_analysis(symbol: str):
    """
    Get Open Interest analysis for a symbol.
    Provides OI buildup signals (Long, Short, Long Unwinding, Short Covering).
    """
    symbol = symbol.upper().strip()
    
    # Get option chain data first
    if symbol in INDEX_FO_SYMBOLS:
        url = f"{NSE_OPTION_CHAIN_INDICES}{symbol}"
    else:
        url = f"{NSE_OPTION_CHAIN_EQUITIES}{symbol}"
    
    try:
        data = await fetch_nse_data(url, symbol)
        records = data.get("records", {})
        underlying_value = records.get("underlyingValue", 0)
        
        # Find ATM strike
        strike_prices = records.get("strikePrices", [])
        atm_strike = min(strike_prices, key=lambda x: abs(x - underlying_value)) if strike_prices else 0
        
        # Analyze OI around ATM
        chain_data = records.get("data", [])
        
        # Get first expiry data only
        first_expiry = records.get("expiryDates", [None])[0]
        expiry_data = [item for item in chain_data if item.get("expiryDate") == first_expiry]
        
        # Calculate max pain
        ce_oi_by_strike = {}
        pe_oi_by_strike = {}
        
        for item in expiry_data:
            strike = item.get("strikePrice", 0)
            ce = item.get("CE", {})
            pe = item.get("PE", {})
            
            if ce:
                ce_oi_by_strike[strike] = ce.get("openInterest", 0)
            if pe:
                pe_oi_by_strike[strike] = pe.get("openInterest", 0)
        
        # Find strike with max CE OI (resistance) and max PE OI (support)
        max_ce_strike = max(ce_oi_by_strike, key=ce_oi_by_strike.get) if ce_oi_by_strike else 0
        max_pe_strike = max(pe_oi_by_strike, key=pe_oi_by_strike.get) if pe_oi_by_strike else 0
        
        # OI change analysis at ATM strikes
        atm_data = next((item for item in expiry_data if item.get("strikePrice") == atm_strike), None)
        
        atm_analysis = None
        if atm_data:
            ce = atm_data.get("CE", {})
            pe = atm_data.get("PE", {})
            atm_analysis = {
                "strike": atm_strike,
                "CE": {
                    "oi": ce.get("openInterest", 0),
                    "oiChange": ce.get("changeinOpenInterest", 0),
                    "volume": ce.get("totalTradedVolume", 0),
                    "iv": ce.get("impliedVolatility", 0),
                },
                "PE": {
                    "oi": pe.get("openInterest", 0),
                    "oiChange": pe.get("changeinOpenInterest", 0),
                    "volume": pe.get("totalTradedVolume", 0),
                    "iv": pe.get("impliedVolatility", 0),
                }
            }
        
        # Calculate PCR
        total_ce_oi = sum(ce_oi_by_strike.values())
        total_pe_oi = sum(pe_oi_by_strike.values())
        pcr = round(total_pe_oi / total_ce_oi, 2) if total_ce_oi > 0 else 0
        
        # Determine sentiment
        if pcr > 1.2:
            sentiment = "Bullish (High PCR)"
        elif pcr < 0.8:
            sentiment = "Bearish (Low PCR)"
        else:
            sentiment = "Neutral"
        
        return {
            "symbol": symbol,
            "underlyingValue": underlying_value,
            "atmStrike": atm_strike,
            "expiry": first_expiry,
            "maxCEOIStrike": max_ce_strike,
            "maxCEOI": ce_oi_by_strike.get(max_ce_strike, 0),
            "maxPEOIStrike": max_pe_strike,
            "maxPEOI": pe_oi_by_strike.get(max_pe_strike, 0),
            "pcr": pcr,
            "sentiment": sentiment,
            "atmAnalysis": atm_analysis,
            "resistanceLevel": max_ce_strike,
            "supportLevel": max_pe_strike,
            "timestamp": datetime.now().isoformat(),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze OI: {str(e)}")
