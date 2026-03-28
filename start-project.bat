@echo off
title KPRMT Full Stack Application

echo ================================================
echo     KPRMT Application - Full Stack Launcher
echo ================================================
echo.

cd /d "%~dp0"

echo [1/5] Stopping any existing servers on ports 8000 and 5173...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 2^>nul') do taskkill /PID %%a /F 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 2^>nul') do taskkill /PID %%a /F 2>nul
timeout /t 1 /nobreak >nul
echo.

echo [2/5] Checking Frontend dependencies...
cd "%~dp0Frontend"
if not exist node_modules (
    echo Installing Frontend npm packages - this may take a minute...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed! Check Node.js is installed.
        pause
        exit /b 1
    )
)
echo Frontend dependencies OK.
cd "%~dp0"
echo.

echo [3/5] Running database migrations...
"%~dp0Backend\.venv_new\Scripts\python.exe" "%~dp0Backend\run_migrations.py"
echo.

echo [4/5] Starting Backend (FastAPI on http://localhost:8000)...
set PYTHONUTF8=1
start /D "%~dp0Backend" "KPRMT Backend - FastAPI" cmd /k ".venv_new\Scripts\uvicorn.exe api_server:app --host 127.0.0.1 --port 8000"
echo Backend starting...
echo.

timeout /t 6 /nobreak >nul

echo [5/5] Starting Frontend (Vite on http://localhost:5173)...
start /D "%~dp0Frontend" "KPRMT Frontend - Vite" cmd /k "npm run dev"
echo Frontend starting...
echo.

timeout /t 6 /nobreak >nul

echo.
echo ================================================
echo     Application is running!
echo ================================================
echo.
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo.
echo   Login:  admin / admin
echo.
echo   Close the two windows to stop the servers.
echo ================================================
echo.

start http://localhost:5173
echo.
pause
