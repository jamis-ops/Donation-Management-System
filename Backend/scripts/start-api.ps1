$phpPaths = @(
  "C:\xampp\php\php.exe",
  "C:\laragon\bin\php\php-8.3.16-Win32-vs16-x64\php.exe"
)

$php = $null
foreach ($p in $phpPaths) {
  if (Test-Path $p) { $php = $p; break }
}

if (-not $php) {
  $found = Get-Command php -ErrorAction SilentlyContinue
  if ($found) { $php = $found.Source }
}

if (-not $php) {
  Write-Host ""
  Write-Host "PHP not found." -ForegroundColor Red
  Write-Host "Install XAMPP, then start Apache + MySQL in XAMPP Control Panel." -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

Write-Host "Starting PHP API at http://localhost:8000" -ForegroundColor Green
Write-Host "Keep this window open while using the website." -ForegroundColor Yellow
Write-Host ""

Set-Location $PSScriptRoot\..
& $php -S localhost:8000 -t api
