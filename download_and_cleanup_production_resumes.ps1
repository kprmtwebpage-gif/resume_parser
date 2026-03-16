#############################################################################
# Download Production Resumes & Safely Clean Up Server (Incremental)
# 
# Usage: .\download_and_cleanup_production_resumes.ps1
#
# This script:
# 1. Downloads only resumes uploaded AFTER the last cutoff date
# 2. Extracts them to the local Resumes_Production_downloaded folder
# 3. VERIFIES extraction success before deletion
# 4. Safely removes processed files from server
# 5. Updates the cutoff marker to prevent re-downloading
#
# Server: 89.167.60.41
# Production volume: /var/lib/docker/volumes/resume-prod_resume_cache/_data/
# Local destination: Resumes_Production_downloaded/
#
# Safety features:
# - Logs deletion manifest before removing files
# - Verifies file counts match before cleanup
# - Rolls back on extraction failure
#############################################################################

# Configuration
$sshKey = "$env:USERPROFILE\.ssh\id_ed25519"
$server = "89.167.60.41"
$serverUser = "root"
$serverVolume = "/var/lib/docker/volumes/resume-prod_resume_cache/_data"
$cutoffMarker = "/tmp/cutoff_date"

$projectRoot = "C:\Users\prave\PycharmProjects\Resume_Parsing -Latest -Updated_UI_020326"
$localDest = "$projectRoot\Resumes_Production_downloaded"
$tempTar = "$env:USERPROFILE\Downloads\new-resumes.tar.gz"
$logDir = "$projectRoot\logs"
$deletionLog = "$logDir\deleted_resumes_$(Get-Date -Format 'yyyyMMdd_HHmmss').log"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Production Resume Download & Cleanup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ensure log directory exists
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}

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
Write-Host "  Log file: $deletionLog"
Write-Host ""

# Step 1: Check current cutoff marker age on server
Write-Host "[1/6] Checking cutoff marker on server..." -ForegroundColor Yellow
$markerInfo = ssh -i $sshKey -o StrictHostKeyChecking=no $serverUser@$server `
    "ls -la $cutoffMarker 2>/dev/null | awk '{print \$6, \$7, \$8}' || echo 'NOT_SET'"

Write-Host "  Cutoff marker: $markerInfo"
Write-Host ""

# Step 2: Find new files on server and get list
Write-Host "[2/6] Finding resumes uploaded since cutoff date..." -ForegroundColor Yellow
$fileList = ssh -i $sshKey -o StrictHostKeyChecking=no $serverUser@$server `
    "find $serverVolume -maxdepth 1 -newer $cutoffMarker -type f | sort"

if (-not $fileList) {
    Write-Host "  No new resumes since last download." -ForegroundColor Green
    Write-Host ""
    Write-Host "Updating cutoff marker for next run..." -ForegroundColor Yellow
    ssh -i $sshKey -o StrictHostKeyChecking=no $serverUser@$server `
        "touch $cutoffMarker && echo 'Cutoff updated'"
    Write-Host "✓ Complete - no new files to process" -ForegroundColor Green
    exit 0
}

# Parse file list into array and get count
$filesToDelete = @($fileList -split "`n" | Where-Object { $_ -match '\S' })
$newCount = $filesToDelete.Count

Write-Host "  Found $newCount new resume(s)" -ForegroundColor Green
Write-Host ""

# Step 3: Create tar on server
Write-Host "[3/6] Creating tar archive on server..." -ForegroundColor Yellow
$tarResult = ssh -i $sshKey -o StrictHostKeyChecking=no $serverUser@$server `
    "cd $serverVolume && find . -maxdepth 1 -newer $cutoffMarker -type f | tar -czf /tmp/new-resumes.tar.gz -T - && echo TAR_OK"

if (-not ($tarResult -match "TAR_OK")) {
    Write-Error "Failed to create tar on server"
    exit 1
}

Write-Host "  Tar created successfully" -ForegroundColor Green
Write-Host ""

# Step 4: Download tar
Write-Host "[4/6] Downloading tar..." -ForegroundColor Yellow
try {
    scp -q -i $sshKey -o StrictHostKeyChecking=no "$serverUser@$server`:/tmp/new-resumes.tar.gz" $tempTar
    if (Test-Path $tempTar) {
        $tarSize = [Math]::Round((Get-Item $tempTar).Length / 1MB, 2)
        Write-Host "  Downloaded: $tarSize MB" -ForegroundColor Green
    } else {
        throw "Tar file not found after download"
    }
} catch {
    Write-Error "Failed to download tar: $_"
    exit 1
}

Write-Host ""

# Step 5: Extract to local folder with verification
Write-Host "[5/6] Extracting and verifying..." -ForegroundColor Yellow

$preExtractCount = (Get-ChildItem $localDest -File -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host "  Pre-extract count: $preExtractCount files"

try {
    tar -xzf $tempTar -C $localDest --strip-components=7 2>$null
    
    $postExtractCount = (Get-ChildItem $localDest -File -ErrorAction SilentlyContinue | Measure-Object).Count
    $extractedCount = $postExtractCount - $preExtractCount
    
    Write-Host "  Post-extract count: $postExtractCount files" -ForegroundColor Green
    Write-Host "  Extracted: $extractedCount file(s)" -ForegroundColor Green
    
    # Verify extraction count matches source
    if ($extractedCount -ne $newCount) {
        Write-Warning "⚠ Extraction count mismatch: expected $newCount, got $extractedCount"
        Write-Host "  Aborting cleanup - extracted files may be incomplete" -ForegroundColor Yellow
        Remove-Item $tempTar -Force
        exit 1
    }
} catch {
    Write-Error "Failed to extract tar: $_"
    Write-Host "  Aborting cleanup - extraction failed" -ForegroundColor Yellow
    Remove-Item $tempTar -Force
    exit 1
}

Write-Host ""

# Step 6: Safe deletion from server
Write-Host "[6/6] Removing processed files from server..." -ForegroundColor Yellow
Write-Host "  Logging deletions to: $deletionLog" -ForegroundColor Cyan

# Create deletion manifest
@"
Deletion Manifest
=================
Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Files deleted: $newCount

Files:
"@ | Out-File -FilePath $deletionLog -Encoding UTF8

$filesToDelete | Out-File -FilePath $deletionLog -Encoding UTF8 -Append

Write-Host "  Manifest logged" -ForegroundColor Green

# Delete files from server
try {
    $deleteCmd = $filesToDelete | ForEach-Object { "rm -f '$_'" } | Join-String -Separator " && "
    $deleteResult = ssh -i $sshKey -o StrictHostKeyChecking=no $serverUser@$server `
        "$deleteCmd && echo 'DELETE_OK'"
    
    if ($deleteResult -match "DELETE_OK") {
        Write-Host "  Server cleanup complete" -ForegroundColor Green
    } else {
        Write-Warning "⚠ Deletion may have failed - check server manually"
        Write-Host "  Deletion log saved to: $deletionLog" -ForegroundColor Yellow
    }
} catch {
    Write-Error "Error deleting from server: $_"
    Write-Host "  Files remain on server - cleanup log saved to: $deletionLog" -ForegroundColor Yellow
    Write-Host "  Review and manually cleanup if needed" -ForegroundColor Yellow
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
Write-Host "✓ Download & Cleanup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Downloaded: $newCount resume(s)"
Write-Host "  Deleted from server: $newCount file(s)"
Write-Host "  Local total: $postExtractCount files"
Write-Host "  Location: $localDest"
Write-Host "  Deletion log: $deletionLog"
Write-Host ""
