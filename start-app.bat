@echo off
echo ============================================
echo   Starting KPRMT Resume Parser Application
echo ============================================
echo.

REM Start Backend (Python FastAPI)
echo [1/3] Starting Backend Server...
start cmd /k "cd /d "%~dp0Backend" && pip install -r requirements.txt --quiet && python api_server.py"

REM Wait for backend to initialize
echo Waiting for backend to start...
timeout /t 8 /nobreak >nul

REM Start Frontend (React Vite)
echo [2/3] Starting Frontend Server...
start cmd /k "cd /d "%~dp0Frontend" && npm install && npm run dev"

REM Wait for frontend to start
echo Waiting for frontend to start...
timeout /t 8 /nobreak >nul

REM Open Browser
echo [3/3] Opening Browser...
start http://localhost:5173

echo.
echo ============================================
echo   Application Started Successfully!
echo   Backend:  http://127.0.0.1:8000
echo   Frontend: http://localhost:5173
echo   API Docs: http://127.0.0.1:8000/docs
echo ============================================
echo.
pause
