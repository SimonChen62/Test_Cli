$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$apiPort = 8000
$webPort = 5190

function Reset-CalliLensPort {
  param(
    [int]$Port,
    [string]$Marker
  )

  $connections = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
  foreach ($connection in $connections) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)" -ErrorAction SilentlyContinue
    $commandLine = if ($process) { [string]$process.CommandLine } else { "" }
    if ($commandLine -like "*$Marker*") {
      Write-Host "Stopping old CalliLens process on port $Port (PID $($connection.OwningProcess))"
      Stop-Process -Id $connection.OwningProcess -Force
      Start-Sleep -Milliseconds 600
    } else {
      throw "Port $Port is already used by PID $($connection.OwningProcess): $commandLine"
    }
  }
}

Reset-CalliLensPort -Port $apiPort -Marker "backend.app.main:app"
Reset-CalliLensPort -Port $webPort -Marker "http.server $webPort"

Write-Host "Starting CalliLens API at http://localhost:$apiPort"
Start-Process -FilePath "python" -ArgumentList @("-m", "uvicorn", "backend.app.main:app", "--host", "127.0.0.1", "--port", "$apiPort") -WorkingDirectory $root -WindowStyle Hidden
Start-Sleep -Seconds 2

Write-Host "Starting CalliLens web at http://127.0.0.1:$webPort/web/"
Start-Process -FilePath "powershell" -ArgumentList @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  "Set-Location '$root'; python -m http.server $webPort --bind 127.0.0.1"
) -WindowStyle Hidden
Start-Sleep -Seconds 1

Start-Process "http://127.0.0.1:$webPort/web/"
