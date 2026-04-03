# Resume Parser - Start Both Servers
# This script starts both backend and frontend servers reliably

Write-Host "=== Resume Parser - Starting Servers ===" -ForegroundColor Cyan
Write-Host ""

# Pick a Python executable (prefer Backend\.venv_new if present, else root .venv)
$pythonExeCandidates = @(
    (Join-Path $PSScriptRoot "Backend\.venv_new\Scripts\python.exe"),
    (Join-Path $PSScriptRoot ".venv\Scripts\python.exe")
)
$pythonExe = $pythonExeCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $pythonExe) {
    Write-Host "✗ Python virtual environment not found." -ForegroundColor Red
    Write-Host "  Looked for:" -ForegroundColor Yellow
    $pythonExeCandidates | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
    exit 1
}

# Check if PostgreSQL is accessible
Write-Host "Checking PostgreSQL connection..." -ForegroundColor Yellow
try {
    $backendEnvPath = Join-Path $PSScriptRoot "Backend\.env"
    $backendEnvPathPy = $backendEnvPath.Replace('\\', '/')
    $pgTest = & $pythonExe -c "import psycopg2, os; from dotenv import load_dotenv; load_dotenv(r'$backendEnvPathPy'); psycopg2.connect(dbname=os.getenv('DB_NAME'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD'), host=os.getenv('DB_HOST'), port=os.getenv('DB_PORT')).close(); print('OK')" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ PostgreSQL connection OK" -ForegroundColor Green
    } else {
        Write-Host "⚠ PostgreSQL connection failed. Backend can still start, but some endpoints may error." -ForegroundColor Yellow
        Write-Host "  Check your .env DB_* settings if you want full functionality." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Cannot connect to PostgreSQL. Backend can still start, but some endpoints may error." -ForegroundColor Yellow
}

Write-Host ""

# Start Backend in new window
Write-Host "Starting Backend API Server..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "Backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Backend API Server' -ForegroundColor Green; & '$pythonExe' api_server.py"

Start-Sleep -Seconds 3

# Start Frontend in new window using npm.cmd (avoids PowerShell execution policy issues)
Write-Host "Starting Frontend Dev Server..." -ForegroundColor Yellow
$frontendPath = Join-Path $PSScriptRoot "Frontend"
$npmCmd = "C:\Program Files\nodejs\npm.cmd"

if (Test-Path $npmCmd) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:VITE_API_PROXY_TARGET='http://127.0.0.1:8000'; cd '$frontendPath'; Write-Host 'Frontend Dev Server (Vite)' -ForegroundColor Green; Write-Host ('API proxy target: ' + `$env:VITE_API_PROXY_TARGET) -ForegroundColor Cyan; & '$npmCmd' run dev"
} else {
    Write-Host "✗ npm.cmd not found at: $npmCmd" -ForegroundColor Red
    Write-Host "Please install Node.js or update the path in this script" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== Servers Starting ===" -ForegroundColor Cyan
Write-Host "Backend API:  http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "API Docs:     http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "Frontend UI:  http://127.0.0.1:5173/" -ForegroundColor Green
Write-Host ""
Write-Host "Both servers are running in separate windows." -ForegroundColor Yellow
Write-Host "Close those windows or press Ctrl+C in them to stop the servers." -ForegroundColor Yellow
Write-Host ""
Write-Host "Waiting 5 seconds before opening browser..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# Open browser
Start-Process "http://127.0.0.1:5173/"

Write-Host ""
Write-Host "Browser opened. If UI is blank, wait 10 seconds and refresh." -ForegroundColor Yellow
Write-Host "Press any key to exit this launcher (servers will keep running)..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
