# Building the static Tailwind stylesheet.
#
# Replaces the Play CDN - a 441 KB Tailwind compiler that otherwise runs in
# the browser on every app start. The result is a ready-made stylesheet,
# usually around fifteen kilobytes.
#
# Node is not required: Tailwind ships a standalone executable.
# Download it once and put it next to this script:
#
#   https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-windows-x64.exe
#   save as tools\tailwindcss.exe
#
# Run from the project root:
#   powershell -ExecutionPolicy Bypass -File .\tools\build-css.ps1
#
# Rebuild after new Tailwind classes appear in the markup. Forget to, and the
# class simply will not apply - which is visible immediately.
#
# NOTE: comments here are in English on purpose. Windows PowerShell 5.1 reads
# .ps1 files as ANSI, so Cyrillic without a BOM turns into garbage and breaks
# parsing. Keeping this file ASCII removes the encoding trap entirely.

param(
    # Watch for changes and rebuild on the fly
    [switch]$Watch
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $PSScriptRoot 'tailwindcss.exe'
$inputCss = Join-Path $root 'css\input.css'
$outputCss = Join-Path $root 'css\tailwind.css'

if (-not (Test-Path $exe)) {
    Write-Host ""
    Write-Host "Not found: $exe" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Download the standalone Tailwind CLI (no Node needed) as tools\tailwindcss.exe:"
    Write-Host '  Invoke-WebRequest -Uri "https://github.com/tailwindlabs/tailwindcss/releases/download/v3.4.17/tailwindcss-windows-x64.exe" -OutFile ".\tools\tailwindcss.exe"' -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

$cliArgs = @('-c', (Join-Path $root 'tailwind.config.js'), '-i', $inputCss, '-o', $outputCss, '--minify')
if ($Watch) { $cliArgs += '--watch' }

Write-Host "Building $outputCss ..." -ForegroundColor Gray
& $exe @cliArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed (exit code $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

if (Test-Path $outputCss) {
    $size = [math]::Round((Get-Item $outputCss).Length / 1KB, 1)
    Write-Host "Done: $outputCss, $size KB" -ForegroundColor Green
    Write-Host "Play CDN used to ship 441 KB of compiler to every visitor." -ForegroundColor Gray
}
