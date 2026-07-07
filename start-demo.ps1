$ErrorActionPreference = "Stop"

$port = 5173
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$existing = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue

if (-not $existing) {
  Write-Host "Starting CalliLens demo at http://localhost:$port/web/"
  Start-Process -FilePath "python" -ArgumentList @("-m", "http.server", "$port") -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Seconds 1
} else {
  Write-Host "CalliLens demo is already running at http://localhost:$port/web/"
}

Start-Process "http://localhost:$port/web/"
