@echo off
setlocal

REM Windows-friendly launcher (works from PowerShell even when npm.ps1 is blocked)
cd /d "%~dp0"

echo Installing dependencies...
"C:\Program Files\nodejs\npm.cmd" install
if errorlevel 1 (
    echo npm install failed!
    pause
    exit /b %errorlevel%
)

echo.
echo Starting Vite dev server...
echo Frontend will be available at: http://127.0.0.1:5173/
echo.
"C:\Program Files\nodejs\npm.cmd" run dev
