@echo off
title KPRMT Full Stack Application
setlocal

echo ================================================
echo     KPRMT Application - Full Stack Launcher
echo ================================================
echo.

cd /d "%~dp0"

:: ── Step 1: Kill any existing processes on our ports ──────────────────
echo [1/5] Stopping any existing servers on ports 8000 and 5173...
for /f "tokens=5 delims= " %%a in ('netstat -ano 2^>nul ^| findstr /R ":8000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5 delims= " %%a in ('netstat -ano 2^>nul ^| findstr /R ":5173 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo Done.
echo.

:: ── Step 2: Verify Python venv exists ───────────────────────────────
echo [2/5] Checking Python virtual environment...
if not exist "%~dp0Backend\.venv_new\Scripts\python.exe" (
    echo ERROR: Python venv not found at Backend\.venv_new\
    echo Please run:  py -m venv Backend\.venv_new  and install requirements.
    pause
    exit /b 1
)
echo Python venv OK.
echo.

:: ── Step 3: Check / install Frontend dependencies ────────────────────
echo [3/5] Checking Frontend dependencies...
cd "%~dp0Frontend"
if not exist node_modules (
    echo Installing Frontend npm packages - this may take a minute...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed! Make sure Node.js is installed.
        pause
        exit /b 1
    )
)
echo Frontend dependencies OK.
cd "%~dp0"
echo.

:: ── Step 4: Run database migrations ──────────────────────────────────
echo [4/5] Running database migrations...
set PYTHONUTF8=1
"%~dp0Backend\.venv_new\Scripts\python.exe" "%~dp0Backend\run_migrations.py"
if errorlevel 1 (
    echo.
    echo WARNING: Migration script returned an error - check DB connection.
    echo          Continuing anyway...
)
echo.

:: ── Step 5: Launch Backend then Frontend ────────────────────────────
echo [5/5] Starting Backend + Frontend servers...
start /D "%~dp0Backend" "KPRMT Backend - FastAPI" cmd /k ".venv_new\Scripts\python.exe -m uvicorn api_server:app --host 127.0.0.1 --port 8000"
echo Backend window opened  (FastAPI on http://localhost:8000)
echo.

echo Waiting for backend to start^...
timeout /t 8 /nobreak >nul

start /D "%~dp0Frontend" "KPRMT Frontend - Vite" cmd /k "set VITE_API_PROXY_TARGET=http://127.0.0.1:8000 & npm run dev"
echo Frontend window opened  (Vite on http://localhost:5173)
echo.

timeout /t 5 /nobreak >nul

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
echo   Close the Backend and Frontend windows to stop servers.
echo ================================================
echo.

start http://localhost:5173
echo.
pause
endlocal
