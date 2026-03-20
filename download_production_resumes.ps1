#############################################################################
# Download Production Resumes (Incremental)
# 
# Usage: .\download_production_resumes.ps1
#
# This script:
# 1. Downloads only resumes uploaded AFTER the last cutoff date
# 2. Extracts them to the local Resumes_Production_downloaded folder
# 3. Updates the cutoff marker to prevent re-downloading
#
# Server: 89.167.60.41
# Production volume: /var/lib/docker/volumes/resume-prod_resume_cache/_data/
# Local destination: Resumes_Production_downloaded/
#
# Zero impact on production server — read-only operations only
#############################################################################

# Configuration
$sshKey = "$env:USERPROFILE\.ssh\id_ed25519"
$server = "89.167.60.41"
$serverUser = "root"
$serverVolume = "/var/lib/docker/volumes/resume-prod_resume_cache/_data"
$cutoffMarker = "/tmp/cutoff_date"

$projectRoot = "C:\Users\prave\PycharmProjects\Resume_Parsing -Latest -Testing-Purpose"
$localDest = "$projectRoot\Resumes_Production_downloaded"
$tempTar = "$env:USERPROFILE\Downloads\new-resumes.tar.gz"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Production Resume Download Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Validate SSH key
if (-not (Test-Path $sshKey)) {
    Write-Error "SSH key not found: $sshKey"
    exit 1
}

# Validate local destination exists
if (-not (Test-Path $localDest)) {
    Write-Error "Destination folder not found: $localDest"
    exit 1
}

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Server: $server"
Write-Host "  Destination: $localDest"
Write-Host ""

# Step 1: Check current cutoff marker age on server
Write-Host "[1/5] Checking cutoff marker on server..." -ForegroundColor Yellow
$markerInfo = ssh -i $sshKey -o StrictHostKeyChecking=no $serverUser@$server `
    "ls -la $cutoffMarker 2>/dev/null | awk '{print \$6, \$7, \$8}' || echo 'NOT_SET'"

Write-Host "  Cutoff marker: $markerInfo"
Write-Host ""

# Step 2: Find new files on server
Write-Host "[2/5] Finding resumes uploaded since cutoff date..." -ForegroundColor Yellow
$findResult = ssh -i $sshKey -o StrictHostKeyChecking=no $serverUser@$server `
    "find $serverVolume -maxdepth 1 -newer $cutoffMarker -type f 2>/dev/null | wc -l"

$newCount = [int]$findResult.Trim()
if ($newCount -eq 0) {
    Write-Host "  No new resumes since last download." -ForegroundColor Green
    Write-Host ""
    Write-Host "Cutoff marker updated to current time (for next run)." -ForegroundColor Green
    ssh -i $sshKey -o StrictHostKeyChecking=no $serverUser@$server `
        "touch $cutoffMarker"
    exit 0
}

Write-Host "  Found $newCount new resume(s)" -ForegroundColor Green
Write-Host ""

# Step 3: Create tar on server
Write-Host "[3/5] Creating tar archive on server..." -ForegroundColor Yellow
$tarResult = ssh -i $sshKey -o StrictHostKeyChecking=no $serverUser@$server `
    "cd $serverVolume && find . -maxdepth 1 -newer $cutoffMarker -type f | tar -czf /tmp/new-resumes.tar.gz -T - && echo TAR_OK"

if (-not ($tarResult -match "TAR_OK")) {
    Write-Error "Failed to create tar on server"
    exit 1
}

Write-Host "  Tar created successfully" -ForegroundColor Green
Write-Host ""

# Step 4: Download tar
Write-Host "[4/5] Downloading tar (~$($newCount * 250)KB estimated)..." -ForegroundColor Yellow
try {
    scp -q -i $sshKey -o StrictHostKeyChecking=no "$serverUser@$server`:/tmp/new-resumes.tar.gz" $tempTar
    if (Test-Path $tempTar) {
        $tarSize = [Math]::Round((Get-Item $tempTar).Length / 1MB, 2)
        Write-Host "  Downloaded: $tarSize MB" -ForegroundColor Green
    }
} catch {
    Write-Error "Failed to download tar: $_"
    exit 1
}

Write-Host ""

# Step 5: Extract to local folder
Write-Host "[5/5] Extracting to local folder..." -ForegroundColor Yellow
try {
    tar -xzf $tempTar -C $localDest --strip-components=7 2>$null
    
    # Count files in destination
    $totalFiles = (Get-ChildItem $localDest -File).Count
    $totalSize = [Math]::Round((Get-ChildItem $localDest -File | Measure-Object Length -Sum).Sum / 1MB, 1)
    
    Write-Host "  Extracted $newCount file(s)" -ForegroundColor Green
    Write-Host "  Total in folder: $totalFiles files `| $totalSize MB" -ForegroundColor Green
} catch {
    Write-Error "Failed to extract tar: $_"
    exit 1
}

# Cleanup temp tar
Remove-Item $tempTar -Force

Write-Host ""

# Update cutoff marker for next run
Write-Host "Updating cutoff marker (next run will only download resumes from now)..." -ForegroundColor Yellow
ssh -i $sshKey -o StrictHostKeyChecking=no $serverUser@$server `
    "touch $cutoffMarker && echo 'Cutoff updated'"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Download complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  $newCount new resume(s) added"
Write-Host "  Total: $totalFiles files `| $totalSize MB"
Write-Host "  Location: $localDest"
Write-Host ""
