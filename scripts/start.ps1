# Запуск API в новом окне + фронт здесь
$scripts = Split-Path -Parent $MyInvocation.MyCommand.Path
Start-Process powershell -ArgumentList "-NoExit", "-File", (Join-Path $scripts "start-api.ps1")
Start-Sleep -Seconds 3
& (Join-Path $scripts "start-web.ps1")
