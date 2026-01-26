# Scripts Directory

This folder contains utility scripts for development, testing, and server management.

## Server Management

- **`run_server.bat`** - Launch FastAPI server on all network interfaces (port 8000)
- **`run_server_lan.bat`** - Launch FastAPI server on alternative port (port 8001)

## Development & Debugging

- **`debug_login.py`** - Debug login issues by checking database credentials
  ```bash
  python -m scripts.debug_login                  # List all users
  python -m scripts.debug_login test@example.com # Check specific user
  ```

- **`fetch_fii_dii_daily.py`** - Fetch FII/DII data manually

## Usage

All Python scripts should be run from the project root using the module syntax:

```bash
python -m scripts.script_name
```

For batch files, you can run them directly:

```bash
scripts\run_server.bat
```
