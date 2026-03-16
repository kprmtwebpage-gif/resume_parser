$sshKey = "$env:USERPROFILE\.ssh\id_ed25519"
$server  = "89.167.60.41"
$user    = "root"
$vol     = "/var/lib/docker/volumes/resume-prod_resume_cache/_data"
$local   = "C:\Users\prave\PycharmProjects\Resume_Parsing -Latest -Testing-Purpose\Resumes_Production_downloaded"

# Fix encoding: read SSH output as UTF-8 (server filenames are UTF-8)
$prevEncoding = [Console]::OutputEncoding
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Fetching file list from production..." -ForegroundColor Yellow
$raw = ssh -i $sshKey -o StrictHostKeyChecking=no "${user}@${server}" "ls -1 '$vol' 2>/dev/null"
if ($LASTEXITCODE -ne 0) { Write-Error "SSH failed"; exit 1 }

$remoteFiles = $raw -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match "\.(pdf|docx|doc)$" }

$localNames = (Get-ChildItem $local -File).Name
$localSet = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)
foreach ($n in $localNames) { [void]$localSet.Add($n) }

$stillMissing = $remoteFiles | Where-Object { -not $localSet.Contains($_) } | Sort-Object

Write-Host "Still missing: $($stillMissing.Count)" -ForegroundColor Cyan
if ($stillMissing.Count -eq 0) { Write-Host "All files already downloaded!" -ForegroundColor Green; exit 0 }

$stillMissing | ForEach-Object { Write-Host "  [$_]" -ForegroundColor Yellow }
Write-Host ""

$ok = 0; $fail = 0; $i = 0
foreach ($fname in $stillMissing) {
    $i++
    $tmpName = "resume_retry_${i}" + [System.IO.Path]::GetExtension($fname)
    $localPath = Join-Path $local $fname
    Write-Host "  $fname" -NoNewline

    # On server: cp the file to /tmp with a safe ASCII name
    $cpOut = ssh -i $sshKey -o StrictHostKeyChecking=no "${user}@${server}" "cp '$vol/$fname' /tmp/$tmpName 2>&1 && echo __OK__"

    if ($cpOut -match "__OK__") {
        # SCP from /tmp using the simple ASCII name
        scp -q -i $sshKey -o StrictHostKeyChecking=no "${user}@${server}:/tmp/$tmpName" $localPath 2>$null
        $scpOk = $LASTEXITCODE -eq 0 -and (Test-Path $localPath)
        # Cleanup temp
        ssh -i $sshKey -o StrictHostKeyChecking=no "${user}@${server}" "rm -f /tmp/$tmpName" 2>$null
        if ($scpOk) { $ok++; Write-Host " [OK]" -ForegroundColor Green }
        else         { $fail++; Write-Host " [FAILED - scp error]" -ForegroundColor Red }
    } else {
        $fail++
        Write-Host " [FAILED - cp: $cpOut]" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Done. Downloaded: $ok  Failed: $fail" -ForegroundColor Cyan
Write-Host "Local folder now: $((Get-ChildItem $local -File).Count) files" -ForegroundColor Cyan

[Console]::OutputEncoding = $prevEncoding
