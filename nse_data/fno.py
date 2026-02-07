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
import re


from services.cache import cache
from services.fyers_service import get_fyers_symbols, download_fyers_master, get_fyers_client
from services.option_clock_service import option_clock_service

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
    """Generic NSE data fetcher with proper headers, cookies, and retry logic."""
    # Determine specific Referer and Main Page based on symbol
    is_index = symbol in ["NIFTY", "BANKNIFTY", "FINNIFTY", "MIDCPNIFTY"]
    if is_index:
        main_page = f"https://www.nseindia.com/get-quotes/derivatives?symbol={symbol}"
        referer = f"https://www.nseindia.com/get-quotes/derivatives?symbol={symbol}"
    else:
        main_page = f"https://www.nseindia.com/get-quotes/derivatives?symbol={symbol}"
        referer = f"https://www.nseindia.com/get-quotes/derivatives?symbol={symbol}"

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Referer": referer,
        "X-Requested-With": "XMLHttpRequest",
    }

    async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
        # Step 1: Broad session warming
        try:
            await client.get("https://www.nseindia.com", headers=headers, timeout=10)
            await asyncio.sleep(0.5)
            # Step 2: Navigate to the derivatives page for the specific symbol
            await client.get(main_page, headers=headers, timeout=10)
            await asyncio.sleep(0.5)
        except Exception:
            pass
        
        # Step 3: Fetch the actual API
        for attempt in range(3):
            try:
                # Rotate referer slightly for retries
                if attempt > 0:
                    headers["Referer"] = "https://www.nseindia.com/option-chain"
                
                response = await client.get(url, headers=headers)
                
                if response.status_code == 200:
                    try:
                        data = response.json()
                        if data and "records" in data:
                            return data
                    except Exception:
                        pass
                
                # If 401/403 or empty data, clear cookies and re-warm
                if response.status_code in [401, 403] or not response.text.strip():
                     await client.get("https://www.nseindia.com", headers=headers)
                     await asyncio.sleep(1)
                
                await asyncio.sleep(1)
            except Exception as e:
                if attempt == 2: raise e
                await asyncio.sleep(1)
        
        return {}


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
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze OI: {str(e)}")


@router.get("/search")
async def search_derivatives(
    query: str = Query(..., min_length=2),
    page: int = 1,
    limit: int = 20
):
    """Search for F&O contracts using Fyers Symbol Master."""
    q = query.upper().strip()
    
    # 1. Try Fyers-based Search First
    symbols = get_fyers_symbols()
    if not symbols:
        # Try to download if missing
        await download_fyers_master()
        symbols = get_fyers_symbols()

    if symbols:
        # Smart filtering on Fyers symbols
        matches = []
        q_upper = q.upper()
        parts = q_upper.split()
        
        # 1. Detect Base Symbol
        base_symbol = None
        for p in parts:
            if len(p) >= 3 and p.isalpha():
                base_symbol = p
                break
        if not base_symbol and parts:
            base_symbol = parts[0]
            
        strike_match = re.search(r'(\d+)', q)
        strike_target = float(strike_match.group(1)) if strike_match else None
        
        is_ce = "CE" in q_upper or "CALL" in q_upper
        is_pe = "PE" in q_upper or "PUT" in q_upper
        if not is_ce and not is_pe:
            is_ce = True
            is_pe = True
        
        for s in symbols:
            # Match base symbol
            if base_symbol and base_symbol not in s["symbol"].upper():
                continue
                
            # Check strike
            if strike_target:
                tolerance = 1000 if "NIFTY" in s["symbol"].upper() else 500
                if abs(s["strike"] - strike_target) > tolerance:
                    continue
            
            # Match all parts in description or symbol
            desc = s["description"].upper()
            sym_up = s["symbol"].upper()
            if not all(p in desc or p in sym_up for p in parts):
                continue
                
            # Type filter
            if s["type"] == "CE" and not is_ce: continue
            if s["type"] == "PE" and not is_pe: continue
                
            matches.append(s)
            # We fetch a bit more than needed to ensure we have enough after potential sorting/filtering
            if len(matches) >= 200: break
            
        if matches:
            # Sort: Nearest expiry first, closest strike second
            matches.sort(key=lambda x: (x.get("expiry", "9999999999"), abs(x["strike"] - (strike_target or 0))))
            
            # Apply Pagination here before fetching quotes to avoid hitting Fyers too hard
            total_count = len(matches)
            start_idx = (page - 1) * limit
            end_idx = start_idx + limit
            paged_matches = matches[start_idx:end_idx]
            
            # Fetch real prices via Fyers Quotes API
            access_token = option_clock_service.get_system_access_token()
            results = []
            
            if access_token:
                try:
                    fyers = get_fyers_client(access_token)
                    if paged_matches:
                        target_symbols = ",".join([m["symbol"] for m in paged_matches])
                        quotes_res = fyers.quotes({"symbols": target_symbols})
                        
                        if quotes_res.get("s") == "ok":
                            quote_dict = {item.get("n"): item.get("v", {}) for item in quotes_res.get("d", [])}
                            for m in paged_matches:
                                q_data = quote_dict.get(m["symbol"], {})
                                results.append({
                                    "identifier": m["symbol"],
                                    "display": m["description"],
                                    "symbol": m["underlying"],
                                    "expiry": m["expiry"],
                                    "strike": m["strike"],
                                    "type": m["type"],
                                    "ltp": q_data.get("lp", 0),
                                    "change": q_data.get("ch", 0),
                                    "pChange": q_data.get("chp", 0),
                                    "source": "fyers"
                                })
                            return {"results": results, "total": total_count, "page": page}
                except Exception as fe:
                    print(f"Fyers Quote fetch failed: {fe}")
            
            # Fallback if no token or quotes fail - return metadata only
            for m in paged_matches:
                results.append({
                    "identifier": m["symbol"],
                    "display": m["description"],
                    "symbol": m["underlying"],
                    "expiry": m["expiry"],
                    "strike": m["strike"],
                    "type": m["type"],
                    "ltp": 0,
                    "source": "fyers_meta"
                })
            return {"results": results, "total": total_count, "page": page}

    # No Fyers symbols available
    return {"results": [], "total": 0, "page": page}

