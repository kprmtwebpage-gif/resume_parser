# Build Frontend for Production
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building Frontend for Production" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

cd Frontend

# Check if node_modules exists
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    & "C:\Program Files\nodejs\npm.cmd" install
}

# Build frontend
Write-Host "`nBuilding optimized production bundle..." -ForegroundColor Green
& "C:\Program Files\nodejs\npm.cmd" run build

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✅ Frontend built successfully!" -ForegroundColor Green
    Write-Host "   Output directory: Frontend/dist" -ForegroundColor Gray
} else {
    Write-Host "`n❌ Frontend build failed!" -ForegroundColor Red
    exit 1
}

cd ..
Write-Host "`nReady to run production server with: .\start_production.ps1" -ForegroundColor Cyan
