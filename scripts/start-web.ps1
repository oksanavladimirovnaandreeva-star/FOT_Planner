# Запуск фронта ФОТ (порт 5180, не 5173)
$ErrorActionPreference = "Stop"
$WebDir = Join-Path $PSScriptRoot "..\apps\web" | Resolve-Path
Set-Location $WebDir

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "npm не найден. Установите Node.js LTS: https://nodejs.org/" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "node_modules")) {
    Write-Host "npm install ..." -ForegroundColor Yellow
    npm install
}

Write-Host "ФОТ UI -> http://localhost:5180" -ForegroundColor Green
npm run dev
