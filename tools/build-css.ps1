# Сборка статического CSS из классов Tailwind.
#
# Заменяет Play CDN — компилятор Tailwind весом 441 КБ, который иначе
# работает в браузере при каждом запуске приложения. На выходе — готовый
# CSS, обычно килобайт пятнадцать.
#
# Node не нужен: используется автономный исполняемый файл Tailwind.
# Скачайте его один раз и положите рядом с этим скриптом:
#
#   https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-windows-x64.exe
#   сохранить как tools\tailwindcss.exe
#
# Запуск из корня проекта:
#   powershell -ExecutionPolicy Bypass -File .\tools\build-css.ps1
#
# Пересобирать нужно после добавления в разметку новых классов Tailwind.
# Забыли — класс просто не применится, это видно сразу.

param(
    # Следить за изменениями и пересобирать на лету
    [switch]$Watch
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $PSScriptRoot 'tailwindcss.exe'
$input = Join-Path $root 'css\input.css'
$output = Join-Path $root 'css\tailwind.css'

if (-not (Test-Path $exe)) {
    Write-Host ""
    Write-Host "Не найден $exe" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Скачайте автономный Tailwind (Node не требуется) и сохраните как tools\tailwindcss.exe:"
    Write-Host "  https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-windows-x64.exe" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Одной командой:" -ForegroundColor Gray
    Write-Host '  Invoke-WebRequest -Uri "https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-windows-x64.exe" -OutFile ".\tools\tailwindcss.exe"' -ForegroundColor Gray
    Write-Host ""
    exit 1
}

$args = @('-c', (Join-Path $root 'tailwind.config.js'), '-i', $input, '-o', $output, '--minify')
if ($Watch) { $args += '--watch' }

Write-Host "Собираем $output ..." -ForegroundColor Gray
& $exe @args

if ($LASTEXITCODE -ne 0) {
    Write-Host "Сборка не удалась (код $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

if (Test-Path $output) {
    $size = [math]::Round((Get-Item $output).Length / 1KB, 1)
    Write-Host "Готово: $output, $size КБ" -ForegroundColor Green
    Write-Host "Было у Play CDN: 441 КБ компилятора в браузере." -ForegroundColor Gray
}
