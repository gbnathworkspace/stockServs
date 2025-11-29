@echo off
echo Starting Stock Services Server...
echo Access at http://localhost:8000
call venv\Scripts\activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000
pause
