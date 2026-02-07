# Host Locally

## Backend
1. Clone the repo
2. Run `pip install -r requirements.txt`
3. Copy `.env.example` to `.env` and fill values (DATABASE_URL, JWT_SECRET, etc.)
4. Ensure PostgreSQL is running (or use Docker: `docker compose up -d`)
5. Run `uvicorn main:app --reload`
6. Backend available at `http://localhost:8000`

## Frontend
1. `cd frontend`
2. `npm install`
3. `npm run dev`
4. Frontend available at `http://localhost:5173`

## Full Stack via Docker
1. `docker build -t stock_servs .`
2. `docker run -p 8000:8000 stock_servs`
3. App available at `http://localhost:8000`

## Troubleshooting
- Port 8000 in use → kill process or change port in uvicorn command
- DB connection refused → ensure PostgreSQL/Docker is running
- CORS errors → check `ALLOWED_ORIGINS` env var
- 401 Unauthorized → token expired, re-login

---
**Changelog**
- 2026-02-07: Initial version
