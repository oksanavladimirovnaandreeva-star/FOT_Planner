# Start FOT API (Windows)
[CmdletBinding()]
param(
  [switch]$ForceKillPort
)

$ErrorActionPreference = "Stop"
$ApiDir = Join-Path $PSScriptRoot "..\apps\api" | Resolve-Path

function Get-PythonExe {
  $paths = @(
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe",
    "$env:ProgramFiles\Python312\python.exe",
    "$env:ProgramFiles\Python313\python.exe"
  )
  foreach ($p in $paths) {
    if (Test-Path $p) { return $p }
  }
  if (Get-Command py -ErrorAction SilentlyContinue) {
    return @{ UsePyLauncher = $true }
  }
  foreach ($name in @("python", "python3")) {
    $cmd = Get-Command $name -ErrorAction SilentlyContinue
    if ($cmd -and $cmd.Source -notmatch "WindowsApps") {
      return $cmd.Source
    }
  }
  return $null
}

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

function Stop-PortProcess {
  param([int]$ProcessId)
  try {
    Stop-Process -Id $ProcessId -Force -ErrorAction Stop
    return $true
  } catch {
    $stillRunning = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if (-not $stillRunning) {
      return $true
    }
    try {
      $null = taskkill /PID $ProcessId /F 2>$null
      Start-Sleep -Milliseconds 300
      $stillRunning = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
      if (-not $stillRunning) {
        return $true
      }
      return $false
    } catch {
      return $false
    }
  }
}

$python = Get-PythonExe
if (-not $python) {
  Write-Host "Python not found." -ForegroundColor Red
  Write-Host "Install: winget install Python.Python.3.12" -ForegroundColor Yellow
  exit 1
}

Set-Location $ApiDir
$venv = Join-Path $ApiDir ".venv"
$venvPython = Join-Path $venv "Scripts\python.exe"

$portProc = Get-PortProcess -Port 8000
if ($portProc) {
  if ($ForceKillPort) {
    Write-Host "Port 8000 is busy by $($portProc.Name) (PID $($portProc.Id)). Stopping..." -ForegroundColor Yellow
    $stopped = Stop-PortProcess -ProcessId $portProc.Id
    if (-not $stopped) {
      Write-Host "Cannot stop PID $($portProc.Id)." -ForegroundColor Red
      exit 1
    }
    Start-Sleep -Milliseconds 500
    $stillBusy = Get-PortProcess -Port 8000
    if ($stillBusy) {
      $procExists = Get-Process -Id $stillBusy.Id -ErrorAction SilentlyContinue
      if ($procExists) {
        Write-Host "Port 8000 is still busy (PID $($stillBusy.Id))." -ForegroundColor Red
        exit 1
      }
      Write-Host "Phantom PID $($stillBusy.Id) detected, continue startup attempt." -ForegroundColor DarkYellow
    }
  } else {
    Write-Host "Port 8000 is already busy by $($portProc.Name) (PID $($portProc.Id))." -ForegroundColor Red
    Write-Host "Use .\scripts\restart-api.ps1 or .\scripts\start-api.ps1 -ForceKillPort" -ForegroundColor Yellow
    exit 1
  }
}

if (-not (Test-Path $venvPython)) {
  Write-Host "Creating .venv ..." -ForegroundColor Yellow
  if ($python -is [hashtable] -and $python.UsePyLauncher) {
    & py -3 -m venv $venv
  } else {
    & $python -m venv $venv
  }
  if (-not (Test-Path $venvPython)) {
    Write-Host "Failed to create .venv" -ForegroundColor Red
    exit 1
  }
}

Write-Host "FOT API  -> http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "Swagger -> http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host "Health  -> http://127.0.0.1:8000/api/health" -ForegroundColor Cyan
Write-Host ""

& $venvPython -m pip install -r requirements.txt -q
if ($LASTEXITCODE -ne 0) {
  Write-Host "pip install failed" -ForegroundColor Red
  exit $LASTEXITCODE
}

& $venvPython -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
