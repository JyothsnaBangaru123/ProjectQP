@echo off
title QP Management System Launcher
echo ===================================================
echo   Starting QP Management System
echo ===================================================
echo.

:: Start Flask Backend in a new terminal window
echo Starting Flask API Backend...
start "Flask Backend" cmd /k "cd backend && python run.py"

:: Start React Frontend in a new terminal window
echo Starting React Vite Frontend...
start "React Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ===================================================
echo   Servers launched successfully!
echo   * Backend REST API: http://localhost:5000
echo   * Frontend Client:   http://localhost:5173
echo.
echo   To stop the servers, close their respective windows.
echo ===================================================
pause
