$ErrorActionPreference = 'Stop'
$temporary = Join-Path $env:RUNNER_TEMP ([Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $temporary | Out-Null
$archive = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\release\Kompack-Windows.zip'))
$extracted = Join-Path $temporary 'Kompack Windows package'
Expand-Archive -LiteralPath $archive -DestinationPath $extracted
$source = Join-Path $extracted 'Kompack-Windows'
$mapped = $false
try {
    if (-not (Test-Path 'G:\')) {
        & subst.exe G: $temporary
        if ($LASTEXITCODE -ne 0) { throw 'Tidak dapat memetakan drive G untuk pengujian.' }
        $mapped = $true
        $target = 'G:\Hackathon\Kompack!'
    } else { $target = Join-Path $temporary 'Hackathon\Kompack!' }
    & (Join-Path $source 'Install-Kompack.cmd') -Target $target -NoStart
    if ($LASTEXITCODE -ne 0) { throw 'Installer CMD gagal.' }
    & (Join-Path $target 'Start-Kompack.cmd') -NoBrowser -SmokeTest
    if ($LASTEXITCODE -ne 0) { throw 'Launcher CMD gagal.' }
    $report = Get-Content -Raw -LiteralPath (Join-Path $target '.kompack\start-report.json') | ConvertFrom-Json
    if (-not $report.Https -or -not $report.Production) { throw 'Launcher belum menggunakan HTTPS produksi.' }
    $tls = Get-Content -Raw -LiteralPath (Join-Path $target '.kompack\tls\settings.json') | ConvertFrom-Json
    $env:KOMPACK_PRODUCTION = '1'
    $env:KOMPACK_TLS_PFX = Join-Path $target '.kompack\tls\localhost.pfx'
    $env:KOMPACK_TLS_PASSWORD = $tls.Password
    $env:NODE_EXTRA_CA_CERTS = Join-Path $target '.kompack\tls\Kompack-CA.pem'
    $env:KOMPACK_PACKAGE_SHA256 = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
    & (Join-Path $target 'runtime\node.exe') (Join-Path $PSScriptRoot 'windows-browser.mjs') $target
    if ($LASTEXITCODE -ne 0) { throw 'Pengujian browser Windows gagal.' }
    Copy-Item -LiteralPath (Join-Path $target '.kompack\windows-browser-report.json') -Destination (Join-Path $env:RUNNER_TEMP 'kompack-windows-browser-report.json')
} catch {
    [IO.File]::WriteAllText((Join-Path $env:RUNNER_TEMP 'kompack-windows-error.txt'), ($_.ToString() + "`n" + $_.ScriptStackTrace), [Text.Encoding]::UTF8)
    throw
} finally {
    if ($mapped) { & subst.exe G: /d }
}
