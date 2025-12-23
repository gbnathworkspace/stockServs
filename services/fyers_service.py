from fyers_apiv3 import fyersModel
import os
from dotenv import load_dotenv

load_dotenv()

FYERS_CLIENT_ID = os.getenv("FYERS_CLIENT_ID")
FYERS_SECRET_KEY = os.getenv("FYERS_SECRET_KEY")
FYERS_REDIRECT_URI = os.getenv("FYERS_REDIRECT_URI")

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
        response = fyers_session.generate_access_token()
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
