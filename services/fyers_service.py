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

# Cache for parsed symbols
_SYMBOL_CACHE = {
    "data": [],
    "last_updated": None
}

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
                if len(row) < 16: continue
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
