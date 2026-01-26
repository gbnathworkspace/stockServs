# Startup Scripts Documentation

## Overview

The startup scripts provide automated validation and startup of the StockServs backend, including Fyers token validation for reliable market data.

## Scripts

### 1. `scripts/check_fyers_token.py`

**Purpose:** Validates Fyers access token before server startup

**Exit Codes:**
- `0` - Valid token exists (all systems operational)
- `1` - No token or expired token (will fall back to NSE)
- `2` - Error (database connection issues, etc.)

**Usage:**
```bash
# Manual check
python3 scripts/check_fyers_token.py

# Exit code check
python3 scripts/check_fyers_token.py && echo "Token valid" || echo "No valid token"
```

**Output Examples:**

✅ **Valid Token:**
```
✅ Valid Fyers token found
   User ID: 1
   Created: 2026-01-26 08:00:00
   Expires: 2026-01-27 08:00:00 (24h remaining)
   Token: eyJ0eXAiOiJKV1QiLCJ...

🟢 Market data will use Fyers API (reliable)
✅ All users will see live stock prices
```

⚠️ **Expiring Soon:**
```
⚠️  Fyers token expiring soon: 1h 30m remaining
   User ID: 1
   Expires: 2026-01-26 10:30:00

💡 Consider reconnecting Fyers to avoid interruption
```

❌ **No Token:**
```
❌ No Fyers token found in database

============================================================
⚠️  MARKET DATA WARNING
============================================================

Without a Fyers token, the system will:
  • Fall back to NSE India API (unreliable)
  • Show ₹0.00 prices outside market hours
  • Experience 403 errors due to anti-scraping

📋 TO FIX:
  1. Start the backend server
  2. Login to the app as admin
  3. Go to Settings → Profile
  4. Click 'Connect Fyers'
  5. Complete OAuth flow

✅ Once connected, ALL users will automatically get live data
============================================================
```

---

### 2. `scripts/startup.sh`

**Purpose:** Comprehensive startup validation and server launch

**Features:**
- Environment validation (.env check)
- Python dependency verification
- Database connection test
- Fyers token validation (non-blocking)
- Smart server startup (dev/prod modes)

**Usage:**

```bash
# Development mode (with auto-reload)
./scripts/startup.sh dev

# Production mode (4 workers, optimized)
./scripts/startup.sh prod

# Default (production)
./scripts/startup.sh
```

**Startup Flow:**

```
[1/5] Checking environment...
   ✅ Environment configured

[2/5] Checking Python dependencies...
   Python version: 3.10.12
   ✅ Dependencies ready

[3/5] Checking database connection...
   Connection successful
   ✅ Database accessible

[4/5] Validating Fyers token...
   ✅ Valid Fyers token found
   🟢 Market data will be reliable

[5/5] Starting backend server...
   Starting in PRODUCTION mode
   INFO:     Started server process [1234]
   INFO:     Waiting for application startup.
   INFO:     Application startup complete.
   INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

### 3. `scripts/stockservs.service`

**Purpose:** Systemd service file for production deployments

**Features:**
- Automatic restart on failure
- Pre-flight Fyers token check
- Resource limits
- Security hardening

**Installation:**

```bash
# Copy service file
sudo cp scripts/stockservs.service /etc/systemd/system/

# Edit paths and user if needed
sudo nano /etc/systemd/system/stockservs.service

# Reload systemd
sudo systemctl daemon-reload

# Enable on boot
sudo systemctl enable stockservs

# Start service
sudo systemctl start stockservs

# Check status
sudo systemctl status stockservs
```

**Service Management:**

```bash
# Start
sudo systemctl start stockservs

# Stop
sudo systemctl stop stockservs

# Restart
sudo systemctl restart stockservs

# View logs
sudo journalctl -u stockservs -f

# Check Fyers token without restarting
sudo -u stockservs /opt/stockservs/scripts/check_fyers_token.py
```

---

## Integration

### Docker

The Dockerfile is already configured to use the startup script:

```dockerfile
# Make startup scripts executable
RUN chmod +x scripts/startup.sh scripts/check_fyers_token.py

# Run startup script with Fyers token validation
CMD ["./scripts/startup.sh", "prod"]
```

**Docker Run:**
```bash
docker run -p 8000:8000 --env-file .env stockservs:latest
```

**Docker Compose:**
```yaml
services:
  backend:
    build: .
    ports:
      - "8000:8000"
    env_file: .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "python3", "scripts/check_fyers_token.py"]
      interval: 1h
      timeout: 5s
      retries: 3
```

### CI/CD Pipeline

Add token validation to your deployment pipeline:

**.github/workflows/deploy.yml:**
```yaml
- name: Check Fyers Token Status
  run: |
    ssh ${{ secrets.SSH_HOST }} "
      cd /opt/stockservs
      ./scripts/check_fyers_token.py || echo 'Warning: No Fyers token'
    "
  continue-on-error: true  # Don't block deployment
```

### Manual Deployment

```bash
# 1. Pull latest code
git pull origin main

# 2. Install dependencies
pip install -r requirements.txt

# 3. Run startup script
./scripts/startup.sh prod
```

---

## Environment Variables

Required in `.env`:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host/db

# Fyers OAuth (for token generation)
FYERS_CLIENT_ID=YOUR_CLIENT_ID
FYERS_SECRET_KEY=YOUR_SECRET_KEY
FYERS_REDIRECT_URI=http://localhost:8000/fyers/callback
```

---

## Troubleshooting

### Issue: "No Fyers token found"

**Solution:**
1. Start the server: `./scripts/startup.sh dev`
2. Login to web UI
3. Go to Settings → Profile → Connect Fyers
4. Complete OAuth flow
5. Token is now stored, restart server

### Issue: "Database connection failed"

**Check:**
```bash
# Test DATABASE_URL
echo $DATABASE_URL

# Test connection manually
psql "$DATABASE_URL" -c "SELECT 1"
```

**Solution:**
- Verify DATABASE_URL in .env
- Check database server is running
- Verify network connectivity

### Issue: "Token expired"

**Auto-Fix:**
The server will automatically fall back to NSE data.

**Manual Fix:**
1. Login to app
2. Settings → Profile → Reconnect Fyers
3. Token refreshed automatically

### Issue: "FastAPI not installed"

**Solution:**
```bash
# Install dependencies
pip install -r requirements.txt

# Or use virtual environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## Monitoring

### Health Check Endpoint

Add to `main.py`:
```python
@app.get("/health")
async def health_check(db: Session = Depends(get_db)):
    """Health check endpoint for monitoring."""
    # Check database
    db.execute("SELECT 1")

    # Check Fyers token
    from services.option_clock_service import option_clock_service
    token = option_clock_service.get_system_access_token()

    return {
        "status": "healthy",
        "database": "connected",
        "fyers_token": "valid" if token else "missing"
    }
```

### Cron Job for Token Monitoring

Add to crontab:
```bash
# Check Fyers token every 6 hours
0 */6 * * * /opt/stockservs/scripts/check_fyers_token.py || echo "Fyers token issue" | mail -s "StockServs Alert" admin@example.com
```

---

## Best Practices

### 1. **Always Use Startup Script**
Don't call `uvicorn` directly - use `startup.sh` for validation

❌ Bad:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

✅ Good:
```bash
./scripts/startup.sh prod
```

### 2. **Monitor Token Expiry**
Set up alerts when token expires within 4 hours

### 3. **Automated Token Refresh**
Consider implementing automated token refresh using browser automation

### 4. **Graceful Degradation**
System works without Fyers token (falls back to NSE)

### 5. **Log Rotation**
Configure log rotation for production:
```bash
# /etc/logrotate.d/stockservs
/opt/stockservs/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    missingok
    notifempty
}
```

---

## Development Workflow

```bash
# 1. Pull latest code
git pull

# 2. Start in dev mode (auto-reload)
./scripts/startup.sh dev

# 3. Make changes, server auto-reloads

# 4. Test deployment
./scripts/startup.sh prod

# 5. Deploy
git push
```

---

## Security Considerations

### Token Storage
- ✅ Tokens stored encrypted in PostgreSQL
- ✅ No tokens in logs or environment variables
- ✅ Tokens not exposed to frontend

### Service Hardening
The systemd service includes:
- `NoNewPrivileges=true` - Prevent privilege escalation
- `PrivateTmp=true` - Isolated /tmp
- `ProtectSystem=strict` - Read-only system directories
- `ProtectHome=true` - No access to /home

### Recommendations
1. Run as dedicated `stockservs` user (not root)
2. Use firewall to restrict port 8000 access
3. Use HTTPS with reverse proxy (nginx/caddy)
4. Rotate Fyers tokens regularly
5. Monitor failed authentication attempts

---

## Support

For issues with:
- **Startup scripts**: Check logs with `-v` flag
- **Fyers token**: Reconnect in Settings → Profile
- **Database**: Verify DATABASE_URL
- **Dependencies**: Run `pip install -r requirements.txt`

---

**Last Updated**: 2026-01-26
**Version**: 1.0
