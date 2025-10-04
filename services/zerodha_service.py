### generate login URL
### exchange request token for access token
### fetch holdings using access token
from kiteconnect import KiteConnect
from dotenv import load_dotenv
import os
load_dotenv()
# Load environment variables
KITE_API_KEY = os.getenv("KITE_API_KEY")
KITE_API_SECRET = os.getenv("KITE_API_SECRET")
KITE_REDIRECT_URL = os.getenv("KITE_REDIRECT_URL")

# Create KiteConnect instance
kite = KiteConnect(api_key=KITE_API_KEY)


def get_zerodha_login_url():
    """
    Generate Zerodha login URL
    returns str: Login URL
    """
    login_url = kite.login_url()
    return login_url

def generate_access_token(request_token: str):
    """
    Exchange request token for access token
    params:
        request_token (str): Request token from Zerodha
    returns dict: Access token details
    """
    try:
        data = kite.generate_session(request_token, api_secret=KITE_API_SECRET)
        return data
    except Exception as e:
        print(f"Error generating access token: {e}")
        return None

def fetch_holdings(access_token: str):
    """
    Fetch holdings using access token
    params:
        access_token (str): Access token from Zerodha
    returns list: List of holdings
    """
    try:
        kite.set_access_token(access_token)
        holdings = kite.holdings()
        return holdings
    except Exception as e:
        print(f"Error fetching holdings: {e}")
        return None
    