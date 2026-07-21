# Free port and start NodeMailer from mail-service so .env always loads.
$port = 8025
$mailDir = Join-Path $PSScriptRoot '..\mail-service' | Resolve-Path
$envFile = Join-Path $mailDir '.env'
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*MAIL_SERVICE_PORT\s*=\s*(\d+)') { $port = [int]$Matches[1] }
  }
}

$listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
if ($listeners) {
  $pids = $listeners.OwningProcess | Sort-Object -Unique
  foreach ($procId in $pids) {
    Write-Host "Stopping existing process PID $procId on port $port..." -ForegroundColor Yellow
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
  Start-Sleep -Seconds 1
}

Set-Location $mailDir
Write-Host "Starting mail service from $mailDir" -ForegroundColor Green
npm start
