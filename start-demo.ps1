$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiPort = 8000
$webPort = 5190

$apiExisting = Get-NetTCPConnection -LocalPort $apiPort -State Listen -ErrorAction SilentlyContinue
if (-not $apiExisting) {
  Write-Host "Starting CalliLens API at http://localhost:$apiPort"
  Start-Process -FilePath "python" -ArgumentList @("-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "$apiPort") -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Seconds 2
} else {
  Write-Host "CalliLens API is already running at http://localhost:$apiPort"
}

$webExisting = Get-NetTCPConnection -LocalPort $webPort -State Listen -ErrorAction SilentlyContinue
if (-not $webExisting) {
  Write-Host "Starting CalliLens web at http://localhost:$webPort/web/"
  Start-Process -FilePath "python" -ArgumentList @("-m", "http.server", "$webPort") -WorkingDirectory $root -WindowStyle Hidden
  Start-Sleep -Seconds 1
} else {
  Write-Host "CalliLens web is already running at http://localhost:$webPort/web/"
}

Start-Process "http://localhost:$webPort/web/"
