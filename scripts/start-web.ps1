# FOT MVP frontend (port 5174, browser localStorage, no API)
$ErrorActionPreference = "Stop"
$WebDir = Join-Path $PSScriptRoot "..\mvp\frontend" | Resolve-Path
Set-Location $WebDir

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "npm not found. Install Node.js LTS: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "npm install ..." -ForegroundColor Yellow
    npm install
}

try {
    $portInUse = Get-NetTCPConnection -LocalPort 5174 -State Listen -ErrorAction SilentlyContinue
} catch {
    $portInUse = $null
}

if ($portInUse) {
    Write-Host "Stopping old process on port 5174..." -ForegroundColor Yellow
    $portInUse | ForEach-Object {
        Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 1
}

Write-Host "FOT MVP: http://localhost:5174" -ForegroundColor Green

npm run dev
