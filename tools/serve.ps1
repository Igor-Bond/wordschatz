# Локальный статический сервер для проверки PWA.
# Service Worker не работает через file:// — нужен http://localhost.
# Запуск из корня проекта:
#   powershell -ExecutionPolicy Bypass -File .\tools\serve.ps1
# Затем открыть http://localhost:8080/

param(
    # По умолчанию — корень проекта (папка над tools/)
    [string]$Root = (Split-Path -Parent $PSScriptRoot),
    [int]$Port = 8080
)

$mime = @{
    '.html' = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.mjs'  = 'application/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.svg'  = 'image/svg+xml'
    '.woff2'= 'font/woff2'
    '.ico'  = 'image/x-icon'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Serving $Root on http://localhost:$Port/"

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
        $req = $ctx.Request
        $res = $ctx.Response

        $rel = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath).TrimStart('/')
        if ([string]::IsNullOrWhiteSpace($rel)) { $rel = 'index.html' }
        $path = Join-Path $Root ($rel -replace '/', '\')

        # Каталог -> index.html внутри него: без этого /tests/ отдавал
        # приложение вместо страницы проверок
        if (Test-Path $path -PathType Container) {
            $path = Join-Path $path 'index.html'
        }

        if (-not (Test-Path $path -PathType Leaf)) {
            # Отсутствующий файл -> корневая страница. Так же ведёт себя
            # правило SPA на хостинге; заодно видно опечатки в путях
            $path = Join-Path $Root 'index.html'
        }

        $ext = [System.IO.Path]::GetExtension($path).ToLower()
        $ct = $mime[$ext]
        if (-not $ct) { $ct = 'application/octet-stream' }

        $bytes = [System.IO.File]::ReadAllBytes($path)
        $res.ContentType = $ct
        $res.Headers.Add('Cache-Control', 'no-store')
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
        $res.StatusCode = 200
        Write-Host ("{0} {1} -> {2}" -f $req.HttpMethod, $req.Url.AbsolutePath, $res.StatusCode)
        $res.OutputStream.Close()
    } catch {
        Write-Host "ERR: $_"
    }
}
