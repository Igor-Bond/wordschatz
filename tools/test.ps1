# Running the automated checks.
#
# The suite is a plain page: it opens in a browser and reports the result.
# Node is not required - there is none on this machine, and the app itself
# needs no build either.
#
# Run from the project root:
#   powershell -ExecutionPolicy Bypass -File .\tools\test.ps1
#
# The script starts the local server if it is not running yet, then opens
# the checks page. Close the browser tab when done; the server keeps
# running so the app itself can be opened next to it.
#
# NOTE: comments are in English on purpose. Windows PowerShell 5.1 reads
# .ps1 files as ANSI, so Cyrillic without a BOM breaks parsing.

param(
    [int]$Port = 8080
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$url = "http://localhost:$Port/tests/index.html"

# Is anything already answering on that port?
$running = $false
try {
    Invoke-WebRequest -Uri "http://localhost:$Port/index.html" -UseBasicParsing -TimeoutSec 2 | Out-Null
    $running = $true
} catch {
    $running = $false
}

if (-not $running) {
    Write-Host "Starting the local server on port $Port ..." -ForegroundColor Gray
    Start-Process powershell -ArgumentList @(
        '-ExecutionPolicy', 'Bypass',
        '-File', (Join-Path $PSScriptRoot 'serve.ps1'),
        '-Root', $root,
        '-Port', $Port
    ) -WindowStyle Hidden

    Start-Sleep -Seconds 2
}

Write-Host "Opening $url" -ForegroundColor Gray
Start-Process $url

Write-Host ""
Write-Host "The page runs every check on load and shows a summary at the top." -ForegroundColor Gray
Write-Host "Green count means everything passed; failures are listed with the reason." -ForegroundColor Gray
