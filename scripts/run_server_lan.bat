@echo off
REM Launch FastAPI server accessible on LAN on alternative port 8001
python -m uvicorn main:app --host 0.0.0.0 --port 8001
