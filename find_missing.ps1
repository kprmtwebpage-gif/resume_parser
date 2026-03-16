$env:PGPASSWORD = "admin"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
$base = "C:\Users\prave\PycharmProjects\Resume_Parsing -Latest -Testing-Purpose"

$dbFiles = (& $psql -U postgres -h 127.0.0.1 -p 5432 -d postgres -t -A -c "SELECT resume_filename FROM candidate_profile WHERE resume_filename IS NOT NULL;") -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -ne "" }
Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue

$dbSet = @{}
$dbFiles | ForEach-Object { $dbSet[$_] = $true }

$localFiles = (Get-ChildItem "$base\Resumes_Production_downloaded" -File | Where-Object { $_.Name -match '\.(pdf|docx|doc)$' }).Name

$missing = $localFiles | Where-Object { -not $dbSet[$_] }
$inDBnotLocal = $dbFiles | Where-Object { $_ -notin $localFiles }

Write-Host "Downloaded files : $($localFiles.Count)"
Write-Host "DB filenames     : $($dbSet.Count)"
Write-Host "Missing from DB  : $($missing.Count)"
Write-Host "In DB not local  : $($inDBnotLocal.Count)"

$missing | Sort-Object | Out-File "$base\missing_from_db.txt" -Encoding UTF8
Write-Host "`nSaved missing list to missing_from_db.txt"
Write-Host "`nSample missing (first 20):"
$missing | Select-Object -First 20
