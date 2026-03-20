$parsedFile = "$env:TEMP\prod_parsed.txt"
$prodFile   = "$env:TEMP\prod_files.txt"

$parsedLines = Get-Content $parsedFile | ForEach-Object { $_.Trim() } | Where-Object { $_ }
$prodLines   = Get-Content $prodFile   | ForEach-Object { $_.Trim() } | Where-Object { $_ }

Write-Host "Files on production volume: $($prodLines.Count)" -ForegroundColor Cyan
Write-Host "Parsed in production DB:    $($parsedLines.Count)" -ForegroundColor Cyan

$parsedSet = @{}
foreach ($p in $parsedLines) { $parsedSet[$p] = $true }

$unparsed = @()
foreach ($f in $prodLines) {
    if (-not $parsedSet.ContainsKey($f)) { $unparsed += $f }
}

Write-Host "UNPARSED: $($unparsed.Count)" -ForegroundColor Red
Write-Host ""
$unparsed | Sort-Object | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }

# Also save to file for reference
$unparsed | Sort-Object | Out-File "$env:TEMP\unparsed_resumes.txt" -Encoding UTF8
Write-Host ""
Write-Host "List saved to: $env:TEMP\unparsed_resumes.txt" -ForegroundColor Cyan
