@echo off
title KPRMT Full Stack Launcher

echo ================================================
echo     KPRMT Application - Full Stack Launcher
echo ================================================
echo.

cd /d %~dp0

echo [1/4] Killing old dev servers...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5173 2^>nul') do taskkill /PID %%a /F 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5175 2^>nul') do taskkill /PID %%a /F 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8000 2^>nul') do taskkill /PID %%a /F 2>nul
echo Done.
echo.

echo [2/4] Checking Frontend dependencies...
if not exist node_modules (
    echo Installing dependencies...
    npm install
    if errorlevel 1 (
        echo.
        echo ERROR: npm install failed!
        pause
        exit /b 1
    )
)
echo Frontend ready.
echo.

echo [3/4] Starting Backend Server (FastAPI)...
start "KPRMT Backend" cmd /k "cd /d "%~dp0..\Backend" && .venv\Scripts\activate.bat && python api_server.py"
echo Backend starting on http://localhost:8000
echo.

timeout /t 3 /nobreak >nul

echo [4/4] Starting Frontend Server (Vite)...
echo.
echo ================================================
echo  Application Starting...
echo ================================================
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:5175
echo  API Docs: http://localhost:8000/docs
echo.
echo  Login Credentials:
echo    Username: admin
echo    Password: admin
echo.
echo  ⚠️  Session clears when browser closes
echo ================================================
echo.

timeout /t 2 /nobreak >nul

start http://localhost:5175

npm run dev

if errorlevel 1 (
    echo.
    echo ERROR: Failed to start development server!
    pause
)
