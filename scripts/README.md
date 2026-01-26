# Scripts Directory

This folder contains utility scripts for development, testing, and server management.

## 🚀 Production Startup

### **`startup.sh`** - Main startup script with validation
```bash
./scripts/startup.sh dev   # Development mode (auto-reload)
./scripts/startup.sh prod  # Production mode (optimized)
```

**Features:**
- Environment validation (.env check)
- Python dependency verification
- Database connection test
- Fyers token validation (non-blocking)
- Smart server startup

### **`check_fyers_token.py`** - Validates Fyers access token
```bash
python3 scripts/check_fyers_token.py

# Exit codes:
#   0 = Valid token (✅ Reliable market data)
#   1 = No/expired token (⚠️ Will fall back to NSE)
#   2 = Error (❌ Database issue)
```

**Why this matters:** Without a Fyers token, watchlist shows ₹0.00 prices

### **`stockservs.service`** - Systemd service file
```bash
sudo cp scripts/stockservs.service /etc/systemd/system/
sudo systemctl enable --now stockservs
```

📖 **Full documentation:** [docs/STARTUP_SCRIPTS.md](../docs/STARTUP_SCRIPTS.md)

---

## 🪟 Windows Server Management

- **`run_server.bat`** - Launch FastAPI server on all network interfaces (port 8000)
- **`run_server_lan.bat`** - Launch FastAPI server on alternative port (port 8001)

---

## 🔧 Development & Debugging

- **`debug_login.py`** - Debug login issues by checking database credentials
  ```bash
  python -m scripts.debug_login                  # List all users
  python -m scripts.debug_login test@example.com # Check specific user
  ```

- **`debug_watchlist.py`** - Debug watchlist data and caching

- **`fetch_fii_dii_daily.py`** - Fetch FII/DII data manually

- **`get_db_errors.py`** - Retrieve and analyze database errors

- **`get_raw_direct.py`** - Fetch raw market data directly

- **`get_raw_market_map.py`** - Test market data mappings

---

## 📋 Quick Start

### First-Time Setup
```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
nano .env

# 3. Start server
./scripts/startup.sh dev
```

### Fix ₹0.00 Prices (Connect Fyers)
```bash
# 1. Start server
./scripts/startup.sh dev

# 2. Open: http://localhost:8000
# 3. Login → Settings → Connect Fyers
# 4. Verify token
python3 scripts/check_fyers_token.py
```

---

## 🐳 Docker

The startup script is automatically used in Docker:

```bash
docker build -t stockservs .
docker run -p 8000:8000 --env-file .env stockservs
```

---

## Usage

**Python scripts** - Run from project root:
```bash
python3 scripts/script_name.py
# or
python -m scripts.script_name
```

**Shell scripts** - Run directly:
```bash
./scripts/startup.sh prod
```

**Batch files (Windows)** - Run directly:
```bash
scripts\run_server.bat
```
