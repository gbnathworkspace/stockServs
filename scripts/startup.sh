#!/bin/bash
###############################################################################
# StockServs Startup Script
# Validates environment and starts the backend server
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           StockServs Backend Startup Validator           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

cd "$PROJECT_ROOT"

###############################################################################
# 1. Environment Check
###############################################################################
echo -e "${BLUE}[1/5] Checking environment...${NC}"

# Check if DATABASE_URL is already set (e.g., from Docker environment variables)
if [ -z "$DATABASE_URL" ]; then
    # DATABASE_URL not set, try loading from .env file
    if [ ! -f ".env" ]; then
        echo -e "${RED}❌ .env file not found and DATABASE_URL not set${NC}"
        echo "   Either:"
        echo "   - Copy .env.example to .env and configure it, OR"
        echo "   - Pass DATABASE_URL as an environment variable (Docker/production)"
        exit 1
    fi
    
    # Load environment variables from .env file
    echo "   Loading environment from .env file..."
    set -a
    source .env
    set +a
else
    echo "   Using environment variables from container/system"
fi

# Final validation - DATABASE_URL must be set by now
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not configured${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment configured${NC}"

###############################################################################
# 2. Python Dependencies Check
###############################################################################
echo -e "\n${BLUE}[2/5] Checking Python dependencies...${NC}"

if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 not found${NC}"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2)
echo "   Python version: $PYTHON_VERSION"

# Check if virtual environment should be used
if [ -d "venv" ]; then
    echo "   Using virtual environment: venv/"
    source venv/bin/activate
elif [ -d ".venv" ]; then
    echo "   Using virtual environment: .venv/"
    source .venv/bin/activate
fi

# Check for required packages
if ! python3 -c "import fastapi" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  FastAPI not installed${NC}"
    echo "   Installing dependencies..."
    pip install -r requirements.txt
fi

echo -e "${GREEN}✅ Dependencies ready${NC}"

###############################################################################
# 3. Database Connection Check
###############################################################################
echo -e "\n${BLUE}[3/5] Checking database connection...${NC}"

python3 -c "
import sys
try:
    from sqlalchemy import text
    from database.connection import SessionLocal
    db = SessionLocal()
    db.execute(text('SELECT 1'))
    db.close()
    print('   Connection successful')
    sys.exit(0)
except Exception as e:
    print(f'❌ Database connection failed: {e}')
    sys.exit(1)
" || {
    echo -e "${RED}Failed to connect to database${NC}"
    exit 1
}

echo -e "${GREEN}✅ Database accessible${NC}"

###############################################################################
# 4. Fyers Token Validation (NON-BLOCKING)
###############################################################################
echo -e "\n${BLUE}[4/5] Validating Fyers token...${NC}"

# Temporarily disable exit-on-error for non-blocking check
set +e
python3 "$SCRIPT_DIR/check_fyers_token.py"
TOKEN_STATUS=$?
set -e

if [ $TOKEN_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ Fyers token valid - Market data will be reliable${NC}"
elif [ $TOKEN_STATUS -eq 1 ]; then
    echo -e "${YELLOW}⚠️  No valid Fyers token - Will fall back to NSE data${NC}"
    echo -e "${YELLOW}   Note: This is non-blocking, server will still start${NC}"
    # Don't exit - let server start without Fyers
elif [ $TOKEN_STATUS -eq 2 ]; then
    echo -e "${RED}❌ Token check failed with error${NC}"
    # Don't exit - let server start anyway
fi

###############################################################################
# 5. Start Server
###############################################################################
echo -e "\n${BLUE}[5/5] Starting backend server...${NC}"

# Determine startup mode
STARTUP_MODE="${1:-production}"  # Default to production

case "$STARTUP_MODE" in
    "dev"|"development")
        echo -e "${YELLOW}Starting in DEVELOPMENT mode with auto-reload${NC}"
        exec uvicorn main:app --host 0.0.0.0 --port 8000 --reload
        ;;
    "prod"|"production")
        echo -e "${GREEN}Starting in PRODUCTION mode${NC}"
        exec uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
        ;;
    *)
        echo -e "${RED}Unknown startup mode: $STARTUP_MODE${NC}"
        echo "Usage: $0 [dev|prod]"
        exit 1
        ;;
esac
