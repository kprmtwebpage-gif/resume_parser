# Complete Setup and Run Script for Resume Parser Application
# This script performs all setup steps and then starts the servers

Write-Host "=== Resume Parser - Complete Setup and Startup ===" -ForegroundColor Cyan
Write-Host ""

$projectRoot = $PSScriptRoot
$backendPath = Join-Path $projectRoot "Backend"
$frontendPath = Join-Path $projectRoot "Frontend"
$pythonExe = Join-Path $projectRoot "Backend\.venv_new\Scripts\python.exe"

# Step 1: Check Python environment
Write-Host "Step 1: Checking Python environment..." -ForegroundColor Yellow
if (-not (Test-Path $pythonExe)) {
    Write-Host "✗ Python virtual environment not found at: $pythonExe" -ForegroundColor Red
    Write-Host "Please create a virtual environment first" -ForegroundColor Yellow
    exit 1
}
Write-Host "✓ Python environment found" -ForegroundColor Green
Write-Host ""

# Step 2: Check PostgreSQL connection
Write-Host "Step 2: Checking PostgreSQL connection..." -ForegroundColor Yellow
try {
    $pgTest = & $pythonExe -c "import psycopg2, os; from dotenv import load_dotenv; load_dotenv('$backendPath\.env'); psycopg2.connect(dbname=os.getenv('DB_NAME'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD'), host=os.getenv('DB_HOST'), port=os.getenv('DB_PORT')).close(); print('OK')" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ PostgreSQL connection OK" -ForegroundColor Green
    } else {
        Write-Host "✗ PostgreSQL connection failed. Check Backend\.env settings" -ForegroundColor Red
        Write-Host "Error: $pgTest" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Cannot connect to PostgreSQL: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Setup Database Tables
Write-Host "Step 3: Setting up database tables..." -ForegroundColor Yellow
Push-Location $backendPath
try {
    & $pythonExe "db_setup.py"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database tables created/verified" -ForegroundColor Green
    } else {
        Write-Host "⚠ Database setup may have issues, but continuing..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Database setup error: $_" -ForegroundColor Yellow
}
Pop-Location
Write-Host ""

# Step 4: Load Resume Data from Google Drive
Write-Host "Step 4: Syncing from Google Drive and loading resume data..." -ForegroundColor Yellow
Write-Host "This may take a few minutes depending on the number of resumes..." -ForegroundColor Cyan
Push-Location $backendPath
try {
    & $pythonExe "parser.py"
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Resume data synced and loaded successfully" -ForegroundColor Green
    } else {
        Write-Host "⚠ Data loading may have issues, but continuing..." -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠ Data loading error: $_" -ForegroundColor Yellow
}
Pop-Location
Write-Host ""

# Step 5: Start Backend Server
Write-Host "Step 5: Starting Backend API Server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Backend API Server' -ForegroundColor Green; & '$pythonExe' api_server.py"
Start-Sleep -Seconds 3
Write-Host "✓ Backend server starting..." -ForegroundColor Green
Write-Host ""

# Step 6: Start Frontend Server
Write-Host "Step 6: Starting Frontend Dev Server..." -ForegroundColor Yellow
$npmCmd = "C:\Program Files\nodejs\npm.cmd"

if (Test-Path $npmCmd) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host 'Frontend Dev Server (Vite)' -ForegroundColor Green; & '$npmCmd' run dev"
    Write-Host "✓ Frontend server starting..." -ForegroundColor Green
} else {
    Write-Host "✗ npm.cmd not found at: $npmCmd" -ForegroundColor Red
    Write-Host "Please install Node.js or update the path in this script" -ForegroundColor Yellow
    Write-Host "Backend server is still running on port 8000" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Setup Complete - Servers Running ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Access your application at:" -ForegroundColor Green
Write-Host "  Frontend UI:  http://127.0.0.1:5173/" -ForegroundColor White
Write-Host "  Backend API:  http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  API Docs:     http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host ""
Write-Host "Opening browser in 3 seconds..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
Start-Process "http://127.0.0.1:5173/"
Write-Host ""
Write-Host "Press any key to exit this window (servers will keep running)..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
