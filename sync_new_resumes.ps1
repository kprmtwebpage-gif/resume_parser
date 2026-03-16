param([switch]$SkipParse)

$sshKey       = "$env:USERPROFILE\.ssh\id_ed25519"
$server       = "89.167.60.41"
$serverUser   = "root"
$serverVol    = "/var/lib/docker/volumes/resume-prod_resume_cache/_data"
$projectRoot  = "C:\Users\prave\PycharmProjects\Resume_Parsing -Latest -Testing-Purpose"
$localDest    = "$projectRoot\Resumes_Production_downloaded"
$cacheDir     = "$projectRoot\Resume_Parsing -Latest -Updated_UI\Backend\resumes_cache"
$backendDir   = "$projectRoot\Resume_Parsing -Latest -Updated_UI\Backend"
$venvPython   = "$projectRoot\.venv\Scripts\python.exe"
$dbName="postgres"; $dbUser="postgres"; $dbPassword="admin"; $dbHost="127.0.0.1"; $dbPort="5432"

Write-Host ""
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host "  Sync New Resumes: Prod to Localhost  " -ForegroundColor Cyan
Write-Host "========================================"  -ForegroundColor Cyan
Write-Host ""

foreach ($p in @($sshKey,$localDest,$cacheDir,$backendDir)) {
    if (-not (Test-Path $p)) { Write-Error "Not found: $p"; exit 1 }
}
if (-not $SkipParse -and -not (Test-Path $venvPython)) { Write-Error "Venv not found: $venvPython"; exit 1 }

Write-Host "[1/4] Fetching file list from production server..." -ForegroundColor Yellow
$remoteRaw = ssh -i $sshKey -o StrictHostKeyChecking=no "$serverUser@$server" "ls -1 $serverVol 2>/dev/null"
if ($LASTEXITCODE -ne 0) { Write-Error "SSH failed"; exit 1 }
$remoteFiles = $remoteRaw -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "\.(pdf|docx|doc)$" }
Write-Host "  Production: $($remoteFiles.Count) resume files" -ForegroundColor White

Write-Host "[2/4] Comparing with local copies..." -ForegroundColor Yellow
$localHash = @{}
Get-ChildItem $localDest -File | ForEach-Object { $localHash[$_.Name] = $true }
$newFiles = $remoteFiles | Where-Object { -not $localHash.ContainsKey($_) }

if ($newFiles.Count -eq 0) {
    Write-Host "  Already up-to-date. No new resumes." -ForegroundColor Green
    exit 0
}
Write-Host "  Local: $($localHash.Count) | NEW: $($newFiles.Count)" -ForegroundColor Green
$newFiles | Sort-Object | ForEach-Object { Write-Host "    + $_" -ForegroundColor Cyan }
Write-Host ""

Write-Host "[3/4] Downloading $($newFiles.Count) file(s)..." -ForegroundColor Yellow
$downloaded = @(); $failed = @()
foreach ($file in $newFiles) {
    $remotePath = "${serverUser}@${server}:${serverVol}/${file}"
    $localPath  = Join-Path $localDest $file
    $cachePath  = Join-Path $cacheDir  $file
    Write-Host "  $file" -NoNewline
    scp -q -i $sshKey -o StrictHostKeyChecking=no $remotePath $localPath 2>$null
    if ($LASTEXITCODE -eq 0 -and (Test-Path $localPath)) {
        Copy-Item -Path $localPath -Destination $cachePath -Force
        $downloaded += $file
        Write-Host " [OK]" -ForegroundColor Green
    } else {
        $failed += $file
        Write-Host " [FAILED]" -ForegroundColor Red
    }
}
Write-Host ""
Write-Host "  Downloaded: $($downloaded.Count)  Failed: $($failed.Count)" -ForegroundColor White
if ($failed.Count -gt 0) { $failed | ForEach-Object { Write-Host "  FAILED: $_" -ForegroundColor Red } }
if ($downloaded.Count -eq 0) { Write-Host "Nothing downloaded." -ForegroundColor Yellow; exit 1 }

if ($SkipParse) {
    Write-Host ""
    Write-Host "Skipping parse (-SkipParse). Run without -SkipParse to also parse." -ForegroundColor Yellow
    exit 0
}

Write-Host "[4/4] Parsing $($downloaded.Count) new file(s)..." -ForegroundColor Yellow
$env:DB_NAME             = $dbName
$env:DB_USER             = $dbUser
$env:DB_PASSWORD         = $dbPassword
$env:DB_HOST             = $dbHost
$env:DB_PORT             = $dbPort
$env:RESUME_INPUT_DIR    = $cacheDir
$env:RESUME_INPUT_MODE   = "local"
$env:RESUME_PROCESS_ONLY = ($downloaded -join ";")
$env:DEPLOY_ENV          = "dev"
$env:QUIET               = "0"
Push-Location $backendDir
try { & $venvPython parser.py; $parseExit = $LASTEXITCODE }
finally {
    Pop-Location
    "DB_NAME","DB_USER","DB_PASSWORD","DB_HOST","DB_PORT","RESUME_INPUT_DIR","RESUME_INPUT_MODE","RESUME_PROCESS_ONLY","DEPLOY_ENV","QUIET" | ForEach-Object { Remove-Item "Env:\$_" -ErrorAction SilentlyContinue }
}

if ($parseExit -eq 0) {
    $env:PGPASSWORD = $dbPassword
    $cnt = (& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U $dbUser -h $dbHost -p $dbPort -d $dbName -t -A --pset="pager=off" -c "SELECT COUNT(*) FROM candidate_profile;").Trim()
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    Write-Host ""
    Write-Host "========================================"  -ForegroundColor Green
    Write-Host "  Sync Complete!"                          -ForegroundColor Green
    Write-Host "  Downloaded : $($downloaded.Count)"      -ForegroundColor Green
    Write-Host "  Total in DB: $cnt"                      -ForegroundColor Green
    Write-Host "========================================"  -ForegroundColor Green
} else {
    Write-Host "Parser exited with code $parseExit - check logs above." -ForegroundColor Red
}
Write-Host ""
