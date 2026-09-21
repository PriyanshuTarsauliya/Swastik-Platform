@echo off
title Swastik AI - Autonomous Voice OS
color 0B

echo ===================================================
echo     SWASTIK AI - AUTONOMOUS VOICE PLATFORM
echo ===================================================
echo.
echo [*] Unified Server: FastAPI + Gemini Live AI + React Frontend
echo [*] Database: SQLite (appointments.db)
echo [*] Port: 8000
echo.
echo Starting application...
echo.

if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m uvicorn backend.raw_server:app --host 0.0.0.0 --port 8000 --reload
) else (
    python -m uvicorn backend.raw_server:app --host 0.0.0.0 --port 8000 --reload
)

pause
