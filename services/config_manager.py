
import os
import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# Load environment variables from .env file (for local dev)
load_dotenv()

def get_database_url():
    """
    Retrieves the database URL.
    Priority:
    1. DATABASE_URL environment variable (Local/Direct)
    2. AWS Parameter Store (Production)
    """
    # 1. Try local environment variable
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return db_url

    # 2. Try AWS Parameter Store
    param_name = os.getenv("DB_SSM_PARAM_NAME")
    region = os.getenv("AWS_REGION", "us-east-1")

    if param_name:
        try:
            print(f"Fetching configuration from AWS Parameter Store: {param_name} ({region})")
            ssm = boto3.client('ssm', region_name=region)
            parameter = ssm.get_parameter(Name=param_name, WithDecryption=True)
            return parameter['Parameter']['Value']
        except ClientError as e:
            print(f"Failed to fetch from AWS SSM: {e}")
            raise
        except Exception as e:
            print(f"Unexpected error fetching config: {e}")
            raise

    raise ValueError(
        "Database configuration missing! "
        "Please set 'DATABASE_URL' (local) or 'DB_SSM_PARAM_NAME' (AWS)."
    )
