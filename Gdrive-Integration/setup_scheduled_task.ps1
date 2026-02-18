# Windows Task Scheduler Setup Script
# This creates a scheduled task to automatically sync and parse resumes every 15 minutes

$taskName = "ResumeParserGDriveSync"
$scriptPath = Join-Path $PSScriptRoot "parser.py"
$pythonExe = (Get-Command python).Source
$workingDir = $PSScriptRoot

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue

if ($existingTask) {
    Write-Host "⚠️  Task '$taskName' already exists. Removing it..." -ForegroundColor Yellow
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
}

# Create the action (what to run)
$action = New-ScheduledTaskAction `
    -Execute $pythonExe `
    -Argument "parser.py" `
    -WorkingDirectory $workingDir

# Create the trigger (when to run) - every 15 minutes
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 15)

# Create the principal (who runs it) - current user
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive

# Create settings
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RunOnlyIfNetworkAvailable `
    -MultipleInstances IgnoreNew

# Register the task
Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Automatically syncs resumes from Google Drive and parses them into the database every 15 minutes"

Write-Host ""
Write-Host "✅ Scheduled task created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Task Details:" -ForegroundColor Cyan
Write-Host "  Name: $taskName"
Write-Host "  Runs: Every 15 minutes"
Write-Host "  Command: $pythonExe parser.py"
Write-Host "  Working Directory: $workingDir"
Write-Host ""
Write-Host "📝 Management Commands:" -ForegroundColor Cyan
Write-Host "  View task:    Get-ScheduledTask -TaskName '$taskName'"
Write-Host "  Run now:      Start-ScheduledTask -TaskName '$taskName'"
Write-Host "  Disable task: Disable-ScheduledTask -TaskName '$taskName'"
Write-Host "  Enable task:  Enable-ScheduledTask -TaskName '$taskName'"
Write-Host "  Remove task:  Unregister-ScheduledTask -TaskName '$taskName'"
Write-Host ""
Write-Host "🎯 To change the interval, edit this script and change '-Minutes 15' to your desired interval" -ForegroundColor Yellow
