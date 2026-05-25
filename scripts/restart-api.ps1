# Clean restart of API on port 8000
$ErrorActionPreference = "Stop"
$scripts = Split-Path -Parent $MyInvocation.MyCommand.Path

function Get-PortProcess {
  param([int]$Port)
  try {
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -First 1
    if (-not $conn) { return $null }
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    if ($proc) {
      return [PSCustomObject]@{
        Id = $proc.Id
        Name = $proc.ProcessName
      }
    }
    return [PSCustomObject]@{
      Id = $conn.OwningProcess
      Name = "unknown"
    }
  } catch {
    return $null
  }
}

$portProc = Get-PortProcess -Port 8000
if ($portProc) {
  Write-Host "Stopping process on :8000 -> $($portProc.Name) (PID $($portProc.Id))" -ForegroundColor Yellow
  try {
    Stop-Process -Id $portProc.Id -Force -ErrorAction Stop
  } catch {
    Write-Host "Process $($portProc.Id) is already stopped, continue." -ForegroundColor DarkYellow
  }
  Start-Sleep -Milliseconds 700
}

& (Join-Path $scripts "start-api.ps1") -ForceKillPort
