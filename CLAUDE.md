# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stock Services API - A FastAPI backend service for stock-related operations.

## Development Commands

### Setup
```bash
pip install -r requirements.txt
```

### Run Development Server
```bash
uvicorn main:app --reload
```

### Run Production Server
```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

- `GET /` - Root endpoint, returns API info
- `GET /health` - Health check endpoint, returns service status

## Architecture

- **main.py** - FastAPI application entry point with route definitions
- CORS middleware enabled for all origins (configure appropriately for production)
- Uses async/await pattern for endpoint handlers
