# Resume Parser - Start Both Servers
# This script starts both backend and frontend servers reliably

Write-Host "=== Resume Parser - Starting Servers ===" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is accessible
Write-Host "Checking PostgreSQL connection..." -ForegroundColor Yellow
try {
    $pgTest = & "$PSScriptRoot\Backend\.venv_new\Scripts\python.exe" -c "import psycopg2, os; from dotenv import load_dotenv; load_dotenv(); psycopg2.connect(dbname=os.getenv('DB_NAME'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD'), host=os.getenv('DB_HOST'), port=os.getenv('DB_PORT')).close(); print('OK')" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ PostgreSQL connection OK" -ForegroundColor Green
    } else {
        Write-Host "✗ PostgreSQL connection failed. Check Backend\.env settings" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Cannot connect to PostgreSQL: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Start Backend in new window
Write-Host "Starting Backend API Server..." -ForegroundColor Yellow
$backendPath = Join-Path $PSScriptRoot "Backend"
$venvActivate = Join-Path $PSScriptRoot "Backend\.venv_new\Scripts\Activate.ps1"

if (-not (Test-Path $venvActivate)) {
    Write-Host "✗ Python virtual environment not found at: $venvActivate" -ForegroundColor Red
    Write-Host "Please install dependencies: cd Backend; python -m venv .venv_new; .venv_new\Scripts\activate; pip install -r requirements.txt" -ForegroundColor Yellow
    exit 1
}

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Backend API Server (uvicorn)' -ForegroundColor Green; & '$venvActivate'; python -m uvicorn api_server:app --host 127.0.0.1 --port 8000 --reload"

# Wait for backend to be ready
Write-Host "Waiting for backend to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0
$backendReady = $false

while (-not $backendReady -and $attempt -lt $maxAttempts) {
    $attempt++
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/docs" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        $backendReady = $true
        Write-Host "✓ Backend is ready!" -ForegroundColor Green
    } catch {
        Write-Host "  Attempt $attempt/$maxAttempts : Backend not ready yet..." -ForegroundColor DarkYellow
    }
}

if (-not $backendReady) {
    Write-Host "✗ Backend failed to start after $maxAttempts attempts" -ForegroundColor Red
    Write-Host "Check the Backend API Server window for errors" -ForegroundColor Yellow
    exit 1
}

# Start Frontend in new window using npm.cmd (avoids PowerShell execution policy issues)
Write-Host "Starting Frontend Dev Server..." -ForegroundColor Yellow
$frontendPath = Join-Path $PSScriptRoot "Frontend"
$npmCmd = "C:\Program Files\nodejs\npm.cmd"

if (Test-Path $npmCmd) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host 'Frontend Dev Server (Vite)' -ForegroundColor Green; & '$npmCmd' run dev"
} else {
    Write-Host "✗ npm.cmd not found at: $npmCmd" -ForegroundColor Red
    Write-Host "Please install Node.js or update the path in this script" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "=== Servers Starting ===" -ForegroundColor Cyan
Write-Host "Backend API:  http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "API Docs:     http://127.0.0.1:8000/docs" -ForegroundColor Green
Write-Host "Frontend UI:  http://127.0.0.1:5175/" -ForegroundColor Green
Write-Host ""
Write-Host "Both servers are running in separate windows." -ForegroundColor Yellow
Write-Host "Close those windows or press Ctrl+C in them to stop the servers." -ForegroundColor Yellow
Write-Host ""
Write-Host "Waiting 5 seconds before opening browser..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

# Open browser
Start-Process "http://127.0.0.1:5175/"

Write-Host ""
Write-Host "Browser opened. If UI is blank, wait 10 seconds and refresh." -ForegroundColor Yellow
Write-Host "Press any key to exit this launcher (servers will keep running)..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
