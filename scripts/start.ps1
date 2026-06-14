# Запуск MVP фронта (без API — данные в localStorage)
$scripts = Split-Path -Parent $MyInvocation.MyCommand.Path
& (Join-Path $scripts "start-web.ps1")
