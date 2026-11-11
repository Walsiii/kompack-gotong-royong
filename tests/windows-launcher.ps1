$ErrorActionPreference = 'Stop'
$source = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\.portable-build\Kompack-Windows'))
$temporary = Join-Path $env:RUNNER_TEMP ([Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $temporary | Out-Null
$mapped = $false
try {
    if (-not (Test-Path 'G:\')) {
        & subst.exe G: $temporary
        if ($LASTEXITCODE -ne 0) { throw 'Tidak dapat memetakan drive G untuk pengujian.' }
        $mapped = $true
        $target = 'G:\Hackathon\Kompack!'
    } else { $target = Join-Path $temporary 'Hackathon\Kompack!' }
    & (Join-Path $source 'scripts\Install-Portable.ps1') -Target $target -NoStart
    & (Join-Path $target 'scripts\Start-Kompack.ps1') -NoBrowser -SmokeTest
    $report = Get-Content -Raw -LiteralPath (Join-Path $target '.kompack\start-report.json') | ConvertFrom-Json
    if (-not $report.Https -or -not $report.Production) { throw 'Launcher belum menggunakan HTTPS produksi.' }
    $tls = Get-Content -Raw -LiteralPath (Join-Path $target '.kompack\tls\settings.json') | ConvertFrom-Json
    $env:KOMPACK_PRODUCTION = '1'
    $env:KOMPACK_TLS_PFX = Join-Path $target '.kompack\tls\localhost.pfx'
    $env:KOMPACK_TLS_PASSWORD = $tls.Password
    $env:NODE_EXTRA_CA_CERTS = Join-Path $target '.kompack\tls\Kompack-CA.pem'
    & (Join-Path $target 'runtime\node.exe') (Join-Path $PSScriptRoot 'windows-browser.mjs') $target
    if ($LASTEXITCODE -ne 0) { throw 'Pengujian browser Windows gagal.' }
    Copy-Item -LiteralPath (Join-Path $target '.kompack\windows-browser-report.json') -Destination (Join-Path $env:RUNNER_TEMP 'kompack-windows-browser-report.json')
} catch {
    [IO.File]::WriteAllText((Join-Path $env:RUNNER_TEMP 'kompack-windows-error.txt'), ($_.ToString() + "`n" + $_.ScriptStackTrace), [Text.Encoding]::UTF8)
    throw
} finally {
    if ($mapped) { & subst.exe G: /d }
}
