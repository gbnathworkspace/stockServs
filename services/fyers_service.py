import os
import httpx
import csv
import io
import asyncio
from typing import List, Dict, Optional
from datetime import datetime
from fyers_apiv3 import fyersModel
from dotenv import load_dotenv

load_dotenv()

FYERS_CLIENT_ID = os.getenv("FYERS_CLIENT_ID")
FYERS_SECRET_KEY = os.getenv("FYERS_SECRET_KEY")
FYERS_REDIRECT_URI = os.getenv("FYERS_REDIRECT_URI")

# Symbol master configuration
SYM_MASTER_DIR = os.path.join(os.getcwd(), "data", "symbols")
SYM_MASTER_FO = os.path.join(SYM_MASTER_DIR, "NSE_FO.csv")
SYM_MASTER_CM = os.path.join(SYM_MASTER_DIR, "NSE_CM.csv")

# Cache for parsed symbols
_SYMBOL_CACHE = {
    "data": [],
    "last_updated": None
}

_CM_SYMBOL_CACHE = {
    "data": [],
    "last_updated": None
}

# Index symbol mappings (NSE name -> Fyers format)
INDEX_SYMBOL_MAP = {
    "NIFTY": "NSE:NIFTY50-INDEX",
    "NIFTY 50": "NSE:NIFTY50-INDEX",
    "NIFTY50": "NSE:NIFTY50-INDEX",
    "BANKNIFTY": "NSE:NIFTYBANK-INDEX",
    "NIFTY BANK": "NSE:NIFTYBANK-INDEX",
    "FINNIFTY": "NSE:FINNIFTY-INDEX",
    "NIFTY FIN SERVICE": "NSE:FINNIFTY-INDEX",
    "MIDCPNIFTY": "NSE:MIDCPNIFTY-INDEX",
    "NIFTY MIDCAP SELECT": "NSE:MIDCPNIFTY-INDEX",
    "SENSEX": "BSE:SENSEX-INDEX",
}

# Major indices to fetch for market status
MAJOR_INDICES = [
    {"symbol": "NSE:NIFTY50-INDEX", "name": "NIFTY 50"},
    {"symbol": "NSE:NIFTYBANK-INDEX", "name": "BANK NIFTY"},
    {"symbol": "NSE:FINNIFTY-INDEX", "name": "FIN NIFTY"},
    {"symbol": "NSE:MIDCPNIFTY-INDEX", "name": "MIDCAP NIFTY"},
]

def ensure_master_dir():
    if not os.path.exists(SYM_MASTER_DIR):
        os.makedirs(SYM_MASTER_DIR, exist_ok=True)

def get_fyers_auth_url(state: str = None):
    """
    Step 1: Generate Fyers auth URL for user to authorize
    """
    if not all([FYERS_CLIENT_ID, FYERS_SECRET_KEY, FYERS_REDIRECT_URI]):
        missing = []
        if not FYERS_CLIENT_ID: missing.append("FYERS_CLIENT_ID")
        if not FYERS_SECRET_KEY: missing.append("FYERS_SECRET_KEY")
        if not FYERS_REDIRECT_URI: missing.append("FYERS_REDIRECT_URI")
        print(f"Fyers configuration missing: {', '.join(missing)}")
        return None
        
    fyers_session = fyersModel.SessionModel(
        client_id=FYERS_CLIENT_ID,
        secret_key=FYERS_SECRET_KEY,
        redirect_uri=FYERS_REDIRECT_URI,
        response_type="code",
        grant_type="authorization_code",
        state=state
    )
    
    return fyers_session.generate_authcode()

def generate_fyers_access_token(auth_code: str):
    """
    Step 2: Exchange auth code for access token
    """
    print(f"[FYERS_TOKEN] Starting token exchange...")
    print(f"[FYERS_TOKEN] Client ID: {FYERS_CLIENT_ID[:10]}... (truncated)" if FYERS_CLIENT_ID else "[FYERS_TOKEN] Client ID: NOT SET")
    print(f"[FYERS_TOKEN] Redirect URI: {FYERS_REDIRECT_URI}")
    print(f"[FYERS_TOKEN] Auth code length: {len(auth_code) if auth_code else 0}")
    
    if not FYERS_CLIENT_ID or not FYERS_SECRET_KEY:
        print("[FYERS_TOKEN] ERROR: Fyers credentials not configured")
        return {"s": "error", "message": "Fyers credentials not configured on server", "code": "config_error"}
    
    try:
        fyers_session = fyersModel.SessionModel(
            client_id=FYERS_CLIENT_ID,
            secret_key=FYERS_SECRET_KEY,
            redirect_uri=FYERS_REDIRECT_URI,
            response_type="code",
            grant_type="authorization_code"
        )
        fyers_session.set_token(auth_code)
        # Note: Method is generate_token() not generate_access_token()
        response = fyers_session.generate_token()
        print(f"[FYERS_TOKEN] Response: {response}")
        return response
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        print(f"[FYERS_TOKEN] Exception: {e}")
        print(f"[FYERS_TOKEN] Traceback: {error_details}")
        return {"s": "error", "message": str(e), "code": "exception", "details": error_details}

def refresh_fyers_access_token(refresh_token: str):
    """
    Use refresh token to get a new access token from Fyers.
    Returns same format as generate_fyers_access_token.
    """
    if not FYERS_CLIENT_ID or not FYERS_SECRET_KEY:
        print("[FYERS_REFRESH] ERROR: Fyers credentials not configured")
        return None

    if not refresh_token:
        print("[FYERS_REFRESH] No refresh token available")
        return None

    try:
        fyers_session = fyersModel.SessionModel(
            client_id=FYERS_CLIENT_ID,
            secret_key=FYERS_SECRET_KEY,
            redirect_uri=FYERS_REDIRECT_URI,
            response_type="code",
            grant_type="refresh_token"
        )
        fyers_session.set_token(refresh_token)
        response = fyers_session.generate_token()
        print(f"[FYERS_REFRESH] Response: {response}")
        return response
    except Exception as e:
        print(f"[FYERS_REFRESH] Exception: {e}")
        return None


def get_fyers_client(access_token: str):
    """
    Get an authenticated Fyers client
    """
    return fyersModel.FyersModel(
        client_id=FYERS_CLIENT_ID,
        token=access_token,
        is_async=False,
        log_path=os.getcwd()
    )

def fetch_fyers_holdings(access_token: str):
    """
    Fetch holdings from Fyers
    """
    try:
        fyers = get_fyers_client(access_token)
        response = fyers.holdings()
        if response and response.get("s") == "ok":
            return response.get("holdings", [])
        return []
    except Exception as e:
        print(f"Error fetching Fyers holdings: {e}")
        return []

def fetch_fyers_positions(access_token: str):
    """
    Fetch positions from Fyers
    """
    try:
        fyers = get_fyers_client(access_token)
        response = fyers.positions()
        if response and response.get("s") == "ok":
            return response.get("netPositions", [])
        return []
    except Exception as e:
        print(f"Error fetching Fyers positions: {e}")
        return []

def place_fyers_order(access_token: str, order_data: dict):
    """
    Place an order on Fyers
    """
    try:
        fyers = get_fyers_client(access_token)
        response = fyers.place_order(data=order_data)
        return response
    except Exception as e:
        print(f"Error placing Fyers order: {e}")
        return None

async def download_fyers_master():
    """
    Download the F&O symbol master from Fyers
    """
    ensure_master_dir()
    url = "https://public.fyers.in/sym_details/NSE_FO.csv"
    print(f"[FYERS_DATA] Downloading symbol master from {url}...")
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                with open(SYM_MASTER_FO, "wb") as f:
                    f.write(resp.content)
                print(f"[FYERS_DATA] Successfully saved symbol master to {SYM_MASTER_FO}")
                _SYMBOL_CACHE["last_updated"] = datetime.now()
                return True
            else:
                print(f"[FYERS_DATA] Failed to download master: {resp.status_code}")
                return False
        except Exception as e:
            print(f"[FYERS_DATA] Download error: {e}")
            return False

def get_fyers_symbols():
    """
    Get F&O symbols from CSV
    """
    if _SYMBOL_CACHE["data"] and _SYMBOL_CACHE["last_updated"]:
        # Refresh if older than 1 day
        if (datetime.now() - _SYMBOL_CACHE["last_updated"]).days < 1:
            return _SYMBOL_CACHE["data"]

    if not os.path.exists(SYM_MASTER_FO):
        print("[FYERS_DATA] Symbol master not found locally.")
        return []

    print(f"[FYERS_DATA] Parsing symbol master: {SYM_MASTER_FO}")
    symbols = []
    try:
        with open(SYM_MASTER_FO, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) < 17: continue
                # NEW MAPPING based on debug:
                # 0: FyToken, 1: Description, 9: Symbol, 8: ExpiryTimestamp, 13: Base, 15: Strike, 16: Type
                try:
                    symbols.append({
                        "fyToken": row[0],
                        "description": row[1],
                        "symbol": row[9] if ":" in row[9] else row[2], # Fallback
                        "strike": float(row[15]) if row[15] else 0,
                        "expiry": row[8],
                        "underlying": row[13],
                        "type": row[16] if row[16] in ["CE", "PE"] else ("CE" if "CE" in row[1] else "PE" if "PE" in row[1] else "XX")
                    })
                except:
                    continue

        _SYMBOL_CACHE["data"] = symbols
        _SYMBOL_CACHE["last_updated"] = datetime.now()
        return symbols
    except Exception as e:
        print(f"[FYERS_DATA] Parse error: {e}")
        return []


# ============================================================
# CASH MARKET (Equity) Functions - For Market Sandbox
# ============================================================

async def download_fyers_cm_master():
    """
    Download the Cash Market (equity) symbol master from Fyers.
    """
    ensure_master_dir()
    url = "https://public.fyers.in/sym_details/NSE_CM.csv"
    print(f"[FYERS_DATA] Downloading CM symbol master from {url}...")

    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.get(url)
            if resp.status_code == 200:
                with open(SYM_MASTER_CM, "wb") as f:
                    f.write(resp.content)
                print(f"[FYERS_DATA] Successfully saved CM master to {SYM_MASTER_CM}")
                _CM_SYMBOL_CACHE["last_updated"] = datetime.now()
                _CM_SYMBOL_CACHE["data"] = []  # Clear cache to force re-parse
                return True
            else:
                print(f"[FYERS_DATA] Failed to download CM master: {resp.status_code}")
                return False
        except Exception as e:
            print(f"[FYERS_DATA] CM Download error: {e}")
            return False


def get_fyers_cm_symbols() -> List[Dict]:
    """
    Get Cash Market (equity) symbols from NSE_CM.csv.
    Returns list of dicts with symbol info.
    """
    if _CM_SYMBOL_CACHE["data"] and _CM_SYMBOL_CACHE["last_updated"]:
        if (datetime.now() - _CM_SYMBOL_CACHE["last_updated"]).days < 1:
            return _CM_SYMBOL_CACHE["data"]

    if not os.path.exists(SYM_MASTER_CM):
        print("[FYERS_DATA] CM Symbol master not found locally.")
        return []

    print(f"[FYERS_DATA] Parsing CM symbol master: {SYM_MASTER_CM}")
    symbols = []
    try:
        with open(SYM_MASTER_CM, "r", encoding="utf-8") as f:
            reader = csv.reader(f)
            for row in reader:
                if len(row) < 10:
                    continue
                try:
                    # NSE_CM.csv format:
                    # 0: Fytoken, 1: Symbol Description, 2: Exchange Instrument type
                    # 3: Minimum lot size, 4: Tick size, 5: ISIN, 6: Trading Session
                    # 7: Last update date, 8: Expiry date, 9: Symbol ticker (e.g., NSE:RELIANCE-EQ)
                    # 10: Exchange, 11: Segment, 12: Scrip code, 13: Underlying scrip code

                    fyers_symbol = row[9] if len(row) > 9 else ""
                    if not fyers_symbol or "-EQ" not in fyers_symbol:
                        continue  # Skip non-equity symbols

                    # Extract NSE symbol from Fyers format
                    # NSE:RELIANCE-EQ -> RELIANCE
                    nse_symbol = fyers_symbol.replace("NSE:", "").replace("-EQ", "")

                    symbols.append({
                        "fyers_symbol": fyers_symbol,
                        "symbol": nse_symbol,  # NSE format for frontend
                        "identifier": row[1] if len(row) > 1 else nse_symbol,  # Company name
                        "isin": row[5] if len(row) > 5 else "",
                        "lot_size": int(row[3]) if len(row) > 3 and row[3].isdigit() else 1,
                    })
                except Exception:
                    continue

        _CM_SYMBOL_CACHE["data"] = symbols
        _CM_SYMBOL_CACHE["last_updated"] = datetime.now()
        print(f"[FYERS_DATA] Loaded {len(symbols)} CM symbols")
        return symbols
    except Exception as e:
        print(f"[FYERS_DATA] CM Parse error: {e}")
        return []


def convert_nse_to_fyers(nse_symbol: str, segment: str = "EQ") -> str:
    """
    Convert NSE symbol to Fyers format.
    Examples:
        RELIANCE -> NSE:RELIANCE-EQ
        NIFTY 50 -> NSE:NIFTY50-INDEX
        BANKNIFTY -> NSE:NIFTYBANK-INDEX
    """
    nse_symbol = nse_symbol.upper().strip()

    # Check if it's an index
    if nse_symbol in INDEX_SYMBOL_MAP:
        return INDEX_SYMBOL_MAP[nse_symbol]

    # Regular equity
    return f"NSE:{nse_symbol}-{segment}"


def convert_fyers_to_nse(fyers_symbol: str) -> str:
    """
    Convert Fyers symbol back to NSE format.
    Examples:
        NSE:RELIANCE-EQ -> RELIANCE
        NSE:NIFTY50-INDEX -> NIFTY 50
    """
    if not fyers_symbol:
        return ""

    # Handle index reverse mapping
    for nse, fyers in INDEX_SYMBOL_MAP.items():
        if fyers == fyers_symbol:
            return nse

    # Regular equity: NSE:RELIANCE-EQ -> RELIANCE
    if fyers_symbol.startswith("NSE:"):
        symbol = fyers_symbol[4:]  # Remove "NSE:"
        if "-EQ" in symbol:
            return symbol.replace("-EQ", "")
        if "-INDEX" in symbol:
            return symbol.replace("-INDEX", "")

    return fyers_symbol


def fetch_quotes_batch(access_token: str, symbols: List[str]) -> Dict[str, Dict]:
    """
    Fetch real-time quotes for multiple symbols using Fyers API.
    Max 50 symbols per batch.

    Args:
        access_token: Fyers access token
        symbols: List of Fyers format symbols (e.g., ["NSE:RELIANCE-EQ", "NSE:TCS-EQ"])

    Returns:
        Dict mapping NSE symbol to quote data
    """
    if not symbols:
        return {}

    try:
        fyers = get_fyers_client(access_token)
        quotes_data = {"symbols": ",".join(symbols[:50])}  # Max 50
        response = fyers.quotes(quotes_data)

        if response.get("s") != "ok":
            print(f"[FYERS_QUOTES] Error: {response}")
            return {}

        result = {}
        for item in response.get("d", []):
            fyers_symbol = item.get("n", "")
            v = item.get("v", {})
            nse_symbol = convert_fyers_to_nse(fyers_symbol)

            result[nse_symbol] = {
                "symbol": nse_symbol,
                "fyers_symbol": fyers_symbol,
                "lastPrice": v.get("lp", 0),
                "change": v.get("ch", 0),
                "pChange": v.get("chp", 0),
                "open": v.get("open_price", 0),
                "high": v.get("high_price", 0),
                "low": v.get("low_price", 0),
                "previousClose": v.get("prev_close_price", 0),
                "volume": v.get("volume", 0),
                "bid": v.get("bid", 0),
                "ask": v.get("ask", 0),
            }

        return result
    except Exception as e:
        print(f"[FYERS_QUOTES] Exception: {e}")
        return {}


def fetch_index_quotes(access_token: str) -> List[Dict]:
    """
    Fetch major index quotes from Fyers.
    Returns list of index data for market status display.
    """
    try:
        fyers = get_fyers_client(access_token)
        symbols = [idx["symbol"] for idx in MAJOR_INDICES]
        quotes_data = {"symbols": ",".join(symbols)}
        response = fyers.quotes(quotes_data)

        if response.get("s") != "ok":
            print(f"[FYERS_INDICES] Error: {response}")
            return []

        result = []
        for item in response.get("d", []):
            fyers_symbol = item.get("n", "")
            v = item.get("v", {})

            # Find matching index name
            idx_info = next((idx for idx in MAJOR_INDICES if idx["symbol"] == fyers_symbol), None)
            name = idx_info["name"] if idx_info else convert_fyers_to_nse(fyers_symbol)

            result.append({
                "symbol": name,
                "identifier": name,
                "lastPrice": v.get("lp", 0),
                "change": v.get("ch", 0),
                "pChange": v.get("chp", 0),
                "open": v.get("open_price", 0),
                "high": v.get("high_price", 0),
                "low": v.get("low_price", 0),
                "previousClose": v.get("prev_close_price", 0),
            })

        return result
    except Exception as e:
        print(f"[FYERS_INDICES] Exception: {e}")
        return []


def fetch_historical_data(
    access_token: str,
    symbol: str,
    resolution: str = "5",
    range_from: str = None,
    range_to: str = None
) -> Dict:
    """
    Fetch historical OHLCV data from Fyers for charts.

    Args:
        access_token: Fyers access token
        symbol: Fyers format symbol (e.g., NSE:RELIANCE-EQ)
        resolution: Candle interval - "1", "5", "15", "30", "60" (minutes) or "D" (daily)
        range_from: Start date in YYYY-MM-DD format
        range_to: End date in YYYY-MM-DD format

    Returns:
        Dict with candles array in lightweight-charts format
    """
    try:
        fyers = get_fyers_client(access_token)

        # Calculate date range if not provided
        if not range_to:
            range_to = datetime.now().strftime("%Y-%m-%d")
        if not range_from:
            # Default periods based on resolution
            if resolution == "D":
                days = 365
            elif resolution in ["60", "30"]:
                days = 30
            elif resolution in ["15", "5"]:
                days = 10
            else:
                days = 5
            range_from = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")

        data = {
            "symbol": symbol,
            "resolution": resolution,
            "date_format": "1",  # Unix timestamp
            "range_from": range_from,
            "range_to": range_to,
            "cont_flag": "1"
        }

        response = fyers.history(data=data)

        if response.get("s") != "ok":
            print(f"[FYERS_HISTORY] Error: {response}")
            return {"candles": [], "volume": [], "error": response.get("message", "Unknown error")}

        candles = []
        volume = []

        for item in response.get("candles", []):
            # Fyers format: [timestamp, open, high, low, close, volume]
            ts = item[0]
            o, h, l, c, vol = item[1], item[2], item[3], item[4], item[5]

            candles.append({
                "time": ts,
                "open": o,
                "high": h,
                "low": l,
                "close": c
            })
            volume.append({
                "time": ts,
                "value": vol,
                "color": "#00d09c" if c >= o else "#ff4d4d"
            })

        return {
            "candles": candles,
            "volume": volume,
            "symbol": convert_fyers_to_nse(symbol),
            "resolution": resolution
        }
    except Exception as e:
        print(f"[FYERS_HISTORY] Exception: {e}")
        import traceback
        traceback.print_exc()
        return {"candles": [], "volume": [], "error": str(e)}
