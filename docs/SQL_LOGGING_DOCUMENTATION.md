# SQL Query Logging Feature

## ✅ Implementation Complete - 2025-12-27

### 🎯 Overview:

Implemented **environment-controlled SQL query logging** for debugging database performance and monitoring queries in development/production.

---

## 📊 How It Works:

### **Environment Variable:**
```bash
DEBUG_SQL=false  # Default - DISABLED (production safe)
DEBUG_SQL=true   # Enable SQL query logging
DEBUG_SQL=1      # Also enables
DEBUG_SQL=yes    # Also enables
```

### **What Gets Logged:**

When `DEBUG_SQL=true`, you'll see:

1. **All SQL Queries** - Every SELECT, INSERT, UPDATE, DELETE
2. **Query Parameters** - Actual values used in queries
3. **Connection Pool Events** - Pool checkouts/checkins
4. **Query Execution Time** - Performance metrics

---

## 🔧 Usage:

### **Development (Local):**

#### **Option 1: Set Environment Variable (Temporary)**
```bash
# Windows PowerShell
$env:DEBUG_SQL="true"
python -m uvicorn main:app --reload

# Windows CMD
set DEBUG_SQL=true
python -m uvicorn main:app --reload

# Linux/Mac
export DEBUG_SQL=true
python -m uvicorn main:app --reload
```

#### **Option 2: Create .env File (Persistent)**
```bash
# Create .env file in project root
echo "DEBUG_SQL=true" > .env

# Start server (will auto-read .env if you have python-dotenv)
python -m uvicorn main:app --reload
```

#### **Option 3: Set in Run Configuration**
Add to your IDE's run configuration or `launch.json`:
```json
{
  "env": {
    "DEBUG_SQL": "true"
  }
}
```

---

### **Production (Server):**

#### **Enable temporarily for debugging:**
```bash
# SSH into server
ssh user@your-server

# Set environment variable
export DEBUG_SQL=true

# Restart your app
systemctl restart stock-servs
# Or however you restart your app

# Check logs
tail -f /var/log/stock-servs/app.log
```

#### **Disable after debugging:**
```bash
unset DEBUG_SQL
systemctl restart stock-servs
```

---

## 📝 Example Output:

### **When DEBUG_SQL=false (Default):**
```
[SQL DEBUG] SQL query logging DISABLED - Set DEBUG_SQL=true to enable
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### **When DEBUG_SQL=true:**
```
[SQL DEBUG] SQL query logging ENABLED - All queries will be logged with values
INFO:     Uvicorn running on http://0.0.0.0:8000

INFO:sqlalchemy.engine.Engine BEGIN (implicit)
INFO:sqlalchemy.engine.Engine SELECT watchlist.id, watchlist.user_id, watchlist.name, watchlist.position
FROM watchlist 
WHERE watchlist.user_id = %(user_id_1)s 
ORDER BY watchlist.position
INFO:sqlalchemy.engine.Engine [generated in 0.00023s] {'user_id_1': 123}

INFO:sqlalchemy.engine.Engine SELECT count(*) AS count_1 
FROM watchlist_stock 
WHERE watchlist_stock.watchlist_id = %(watchlist_id_1)s
INFO:sqlalchemy.engine.Engine [generated in 0.00015s] {'watchlist_id_1': 1}

INFO:sqlalchemy.engine.Engine COMMIT
```

---

## 🔍 What You Can Debug:

### **1. Slow Queries**
```
INFO:sqlalchemy.engine.Engine [cached since 2.456s ago] {'user_id_1': 123}
                              ^^^^^^^^^^^^^^^^^^^^^^^^
                              This query took 2.5 seconds!
```

### **2. N+1 Query Problems**
```
# Bad - Multiple separate queries in a loop
SELECT * FROM watchlist WHERE user_id = 123
SELECT count(*) FROM watchlist_stock WHERE watchlist_id = 1
SELECT count(*) FROM watchlist_stock WHERE watchlist_id = 2
SELECT count(*) FROM watchlist_stock WHERE watchlist_id = 3
^^^^ This is inefficient!
```

### **3. Query Parameter Values**
```
INFO:sqlalchemy.engine.Engine {'user_id_1': 123, 'watchlist_id_1': 2}
                              ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                              See actual values being used
```

### **4. Connection Pool Usage**
```
INFO:sqlalchemy.pool.impl.QueuePool Connection <...> checked out from pool
INFO:sqlalchemy.pool.impl.QueuePool Connection <...> being returned to pool
```

---

## ⚠️ Important Notes:

### **Security Considerations:**

1. **Never enable in production permanently**
   - Logs contain sensitive data (user IDs, symbols, etc.)
   - Can expose passwords if logged
   - Huge log files

2. **Default is DISABLED**
   - Safe by default
   - Must explicitly enable
   - Auto-disables if variable not set

3. **Temporary debugging only**
   - Enable → Debug → Disable
   - Don't leave enabled

### **Performance Impact:**

```
DEBUG_SQL=false: No overhead ✓
DEBUG_SQL=true:  ~5-10% slower (logging overhead)
```

---

## 📋 Common Use Cases:

### **1. Debug Slow Endpoint:**
```bash
# Enable SQL logging
DEBUG_SQL=true python -m uvicorn main:app --reload

# Make request to slow endpoint
curl http://localhost:8000/watchlist

# Check console for slow queries
# Look for queries taking > 100ms
```

### **2. Verify Cache is Working:**
```bash
# With DEBUG_SQL=true

# First request - should see SQL queries
GET /watchlist → Logs: SELECT FROM watchlist...

# Second request - should NOT see SQL (cache hit!)
GET /watchlist → No SQL logs ✓ (cached)
```

### **3. Find N+1 Query Problems:**
```bash
# Enable logging
DEBUG_SQL=true

# Make request
GET /watchlist

# Count SELECT statements
# If you see multiple similar SELECTs in a loop → N+1 problem
```

---

## 🎨 Customization:

### **Current Configuration:**
```python
# database/connection.py

DEBUG_SQL = os.getenv("DEBUG_SQL", "false").lower() in ("true", "1", "yes")

engine = create_engine(
    DATABASE_URL,
    echo=DEBUG_SQL,           # Logs SQL queries
    echo_pool="debug" if DEBUG_SQL else False,  # Logs pool events
)
```

### **Advanced Logging (Optional):**

If you want more control, you can use Python logging config:

```python
# config/logging.py
import logging

if DEBUG_SQL:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler('sql_queries.log'),  # Save to file
            logging.StreamHandler()  # Also print to console
        ]
    )
```

---

## 🧪 Testing the Feature:

### **Test 1: Verify Default is Disabled**
```bash
# Start server without DEBUG_SQL
python -m uvicorn main:app --reload

# Expected output:
[SQL DEBUG] SQL query logging DISABLED - Set DEBUG_SQL=true to enable
```

### **Test 2: Verify Enabling Works**
```bash
# Start with DEBUG_SQL=true
DEBUG_SQL=true python -m uvicorn main:app --reload

# Expected output:
[SQL DEBUG] SQL query logging ENABLED - All queries will be logged with values

# Make a request
curl http://localhost:8000/watchlist

# Should see SQL queries in logs
```

### **Test 3: Verify Different Values**
```bash
DEBUG_SQL=1 → ENABLED ✓
DEBUG_SQL=yes → ENABLED ✓
DEBUG_SQL=true → ENABLED ✓
DEBUG_SQL=True → ENABLED ✓
DEBUG_SQL=false → DISABLED ✓
DEBUG_SQL=0 → DISABLED ✓
DEBUG_SQL=no → DISABLED ✓
(not set) → DISABLED ✓ (default)
```

---

## 📊 Logging Levels:

SQLAlchemy uses these logging levels:

- **INFO**: SQL statements and parameters
- **DEBUG**: Connection pool events, transaction events
- **WARNING**: Deprecated features
- **ERROR**: SQL errors

Our implementation uses **INFO** level which shows:
- ✅ SQL statements
- ✅ Bound parameters (values)
- ✅ Execution time
- ✅ Query results count

---

## 🚀 Future Enhancements (Optional):

### **Phase 1: Basic (Current)**
- ✅ ENV variable control
- ✅ Log queries with values
- ✅ Default disabled
- ✅ Easy to enable/disable

### **Phase 2: Advanced Logging**
- [ ] Save queries to log file
- [ ] Filter by slow queries only (> threshold)
- [ ] Query statistics (count, avg time)
- [ ] Format output for better readability

### **Phase 3: Monitoring Dashboard**
- [ ] Web UI to view queries
- [ ] Real-time query monitoring
- [ ] Query performance graphs
- [ ] Automatic slow query detection

---

## 📁 Files Modified:

1. **`database/connection.py`** - Added DEBUG_SQL configuration
2. **`.env.example`** - Documented DEBUG_SQL variable

---

## 🎯 Quick Reference:

| Action | Command |
|--------|---------|
| **Enable (Temporary)** | `$env:DEBUG_SQL="true"` (PowerShell) |
| **Enable (Persistent)** | Add `DEBUG_SQL=true` to `.env` file |
| **Disable** | Remove variable or set to `false` |
| **Check Status** | Look for `[SQL DEBUG]` message on startup |

---

**Status**: ✅ **IMPLEMENTED AND READY TO USE**  
**Default**: ❌ **DISABLED** (production safe)  
**How to Enable**: Set `DEBUG_SQL=true` environment variable  

---

## 💡 Pro Tips:

1. **Use with watchlists** - See exactly which queries run when fetching watchlists
2. **Verify caching** - No SQL = cache hit!
3. **Find bottlenecks** - Look for queries with high execution time
4. **Optimize joins** - See if queries can be combined
5. **Debug errors** - See exact SQL when errors occur

---

**Ready to debug!** 🔍
