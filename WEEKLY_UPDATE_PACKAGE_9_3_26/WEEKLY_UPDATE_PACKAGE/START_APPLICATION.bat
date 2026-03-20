@echo off
title KPRMT Full Stack Application Launcher

echo ================================================
echo        KPRMT Application - Full Stack
echo ================================================
echo.

cd /d "%~dp0"

echo [1/5] Closing existing servers...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 2^>nul') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5175 2^>nul') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 2^>nul') do taskkill /PID %%a /F >nul 2>&1
echo Old servers stopped.
echo.

echo [2/5] Checking Frontend dependencies...
cd Frontend
if not exist node_modules (
    echo Installing frontend packages...
    call npm install
)
echo Frontend ready.
cd ..
echo.

echo [3/5] Preparing Backend...
cd Backend

if not exist ".venv_new" (
    echo Creating Python virtual environment...
    python -m venv .venv_new
)

call .venv_new\Scripts\activate

echo Installing backend requirements...
pip install -r requirements.txt >nul 2>&1

echo Running database migrations...
python run_migrations.py >nul 2>&1

echo Backend ready.
cd ..
echo.

echo [4/5] Starting Backend Server...
start "KPRMT Backend - FastAPI" cmd /k "cd /d "%~dp0Backend" && call .venv_new\Scripts\activate && python -m uvicorn api_server:app --host 127.0.0.1 --port 8000 --reload"

echo Backend running at http://localhost:8000
timeout /t 4 >nul
echo.

echo [5/5] Starting Frontend Server...
start "KPRMT Frontend - Vite" cmd /k "cd /d "%~dp0Frontend" && npm run dev"

echo Frontend running at http://localhost:5175
timeout /t 5 >nul

echo.
echo ================================================
echo Application Started
echo ================================================
echo.
echo Frontend : http://localhost:5175
echo Backend  : http://localhost:8000
echo API Docs : http://localhost:8000/docs
echo.
echo Login:
echo Username: admin
echo Password: admin
echo.
echo Close the server windows to stop the application.
echo ================================================
echo.

start http://localhost:5175

pause