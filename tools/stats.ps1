# Recount the project figures and rewrite the table in docs/NUMBERS.md.
#
# The numbers used to be copied by hand into three documents and drifted
# there silently: QA.md kept calling exercises.js the largest module at
# 972 lines long after it had grown to 1277 and then been split apart.
#
# Run from the project root:
#   powershell -ExecutionPolicy Bypass -File .\tools\stats.ps1
#
# The same figures are verified on every test run by
# tests/suites/numbers.test.js, so a stale table fails the suite rather
# than quietly misinforming a reader.
#
# NOTE: this file is saved as UTF-8 WITH a byte order mark, unlike the
# other scripts here. Windows PowerShell 5.1 reads .ps1 as ANSI unless a
# BOM says otherwise, and this script has to emit Cyrillic table headers.
# Without the BOM the parser choked on the very first Cyrillic literal.
# If you rewrite this file with a plain editor, keep the BOM.

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$numbersFile = Join-Path $root 'docs\NUMBERS.md'

# --- Own JavaScript: js/ only. vendor/ is other people's code and
# --- tests/ is not what ships.
$sources = Get-ChildItem -Path (Join-Path $root 'js') -Filter *.js -Recurse -File

$moduleCount = $sources.Count
$totalLines = 0
$largestName = ''
$largestLines = 0

foreach ($file in $sources) {
    $lines = (Get-Content -LiteralPath $file.FullName).Count
    $totalLines += $lines

    if ($lines -gt $largestLines) {
        $largestLines = $lines
        $largestName = $file.FullName.Substring($root.Length + 1).Replace('\', '/').Substring(3)
    }
}

# --- Checks: one per тест( call, and one file per suite.
$suites = Get-ChildItem -Path (Join-Path $root 'tests\suites') -Filter *.test.js -File
$suiteCount = $suites.Count

$checkCount = 0
foreach ($suite in $suites) {
    # -Encoding UTF8 again: read as ANSI, the Cyrillic in the suite turns
    # to mojibake and the pattern below matches nothing. The script then
    # cheerfully reports zero checks.
    $text = Get-Content -LiteralPath $suite.FullName -Raw -Encoding UTF8
    # One check per тест( call. The Cyrillic literal here is exactly why
    # the file needs its BOM - see the note at the top.
    $checkCount += ([regex]::Matches($text, 'тест\(')).Count
}

$table = @"
| Показатель | Значение |
|---|---|
| Модулей JS | $moduleCount |
| Строк своего JavaScript | $totalLines |
| Крупнейший модуль | $largestName, $largestLines |
| Автоматических проверок | $checkCount |
| Наборов проверок | $suiteCount |
"@

# -Encoding UTF8 is not optional: without it Get-Content assumes ANSI and
# the Cyrillic markers come back as mojibake, so the pattern never matches
# and the script reports "markers not found" on a perfectly good file.
$content = Get-Content -LiteralPath $numbersFile -Raw -Encoding UTF8
$pattern = '(?s)(<!-- НАЧАЛО ЧИСЕЛ -->\r?\n).*?(\r?\n<!-- КОНЕЦ ЧИСЕЛ -->)'

if ($content -notmatch $pattern) {
    Write-Host "Markers not found in $numbersFile" -ForegroundColor Red
    exit 1
}

$updated = [regex]::Replace($content, $pattern, { param($m) $m.Groups[1].Value + $table.TrimEnd() + $m.Groups[2].Value })
Set-Content -LiteralPath $numbersFile -Value $updated -Encoding utf8 -NoNewline

Write-Host "docs/NUMBERS.md updated:" -ForegroundColor Green
Write-Host "  modules      $moduleCount"
Write-Host "  lines        $totalLines"
Write-Host "  largest      $largestName, $largestLines"
Write-Host "  checks       $checkCount in $suiteCount suites"
