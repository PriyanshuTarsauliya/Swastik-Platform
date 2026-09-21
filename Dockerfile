# ── Stage 1: Build Frontend (Vite + React) ─────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /build

# Install dependencies
COPY frontend-app/package*.json ./
RUN npm ci

# Copy frontend source and build
COPY frontend-app/ ./
RUN npm run build

# ── Stage 2: Python Backend Runtime ────────────────────────────
FROM python:3.11-slim

# Install uv for fast dependency resolution
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set the working directory
WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies directly into the system python using uv
RUN uv pip install --system --no-cache -r pyproject.toml

# Copy the rest of the application
COPY . .

# Copy compiled frontend dist from Stage 1 into frontend-app/dist
COPY --from=frontend-builder /build/dist ./frontend-app/dist

# Expose the port the app runs on
EXPOSE 8000

# Start the unified application
CMD ["uvicorn", "backend.raw_server:app", "--host", "0.0.0.0", "--port", "8000"]

