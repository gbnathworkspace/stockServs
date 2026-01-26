# Stage 1: Build React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /build

# Copy frontend package files
COPY frontend/package*.json ./frontend/

# Install dependencies
WORKDIR /build/frontend
RUN npm ci

# Copy frontend source
COPY frontend/ ./

# Build the React app (outputs to ../static/app which is /build/static/app)
RUN npm run build

# Stage 2: Python backend
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code (excluding frontend node_modules via .dockerignore)
COPY . .

# Copy built React app from frontend-builder stage
COPY --from=frontend-builder /build/static/app ./static/app

# Make startup scripts executable
RUN chmod +x scripts/startup.sh scripts/check_fyers_token.py

# Expose port 8000
EXPOSE 8000

# Define environment variable
ENV PYTHONUNBUFFERED=1

# Run startup script with Fyers token validation
CMD ["./scripts/startup.sh", "prod"]
