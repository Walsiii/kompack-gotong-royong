param([switch]$Lan, [switch]$Http, [switch]$NoBrowser, [switch]$SmokeTest, [int]$Port = 5173)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if ($Port -lt 1025 -or $Port -gt 65535) { throw 'Port harus 1025-65535.' }
$project = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $project
try {
    $portableNode = Join-Path $project 'runtime\node.exe'
    $node = if (Test-Path -LiteralPath $portableNode) { $portableNode } else { (Get-Command node -ErrorAction Stop).Source }
    $production = Test-Path -LiteralPath (Join-Path $project 'dist\server\domain.mjs')
    if (-not $production -and -not (Test-Path 'node_modules')) { throw 'Build belum tersedia. Jalankan installer Kompack.' }
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { throw "Port $Port sedang dipakai. Tutup server sebelumnya atau gunakan -Port 5174." }
    $env:PORT = "$Port"
    if ($production) { $env:KOMPACK_PRODUCTION = '1' }
    $httpsInfo = $null
    if (-not $Http) {
        . (Join-Path $PSScriptRoot 'Setup-Https.ps1')
        $httpsInfo = Initialize-KompackHttps $project
        $env:KOMPACK_TLS_PFX = $httpsInfo.Pfx
        $env:KOMPACK_TLS_PASSWORD = $httpsInfo.Password
        $env:NODE_EXTRA_CA_CERTS = $httpsInfo.RootPem
        $env:KOMPACK_CA_CER = $httpsInfo.RootCer
        $env:KOMPACK_CA_FINGERPRINT = $httpsInfo.Fingerprint
        $env:KOMPACK_ENROLL_PORT = "$($Port - 1)"
    } else {
        Remove-Item Env:KOMPACK_TLS_PFX,Env:KOMPACK_TLS_PASSWORD,Env:KOMPACK_TLS_CERT,Env:KOMPACK_TLS_KEY -ErrorAction SilentlyContinue
    }
    $scheme = if ($Http) { 'http' } else { 'https' }
    $url = "${scheme}://localhost:$Port"
    $arguments = @('server/local.mjs')
    if ($Lan) { $arguments += '--lan' }
    $process = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $project -NoNewWindow -PassThru
    $enroll = $null
    try {
        $ready = $false
        for ($i = 0; $i -lt 60; $i++) {
            if ($process.HasExited) { throw 'Server berhenti sebelum siap. Lihat pesan di terminal.' }
            try {
                $config = Invoke-RestMethod -Uri "$url/api/config" -TimeoutSec 2
                if ($config.service -eq 'kompack-local') { $ready = $true; break }
            } catch { Start-Sleep -Milliseconds 500 }
        }
        if (-not $ready) { throw 'Server belum siap atau sertifikat HTTPS belum dipercaya Windows.' }
        # Check the actual application and its JavaScript before opening a browser.
        $html = Invoke-WebRequest -Uri "$url/" -UseBasicParsing -TimeoutSec 10
        $script = [regex]::Match($html.Content, '<script[^>]+src="([^"]+)"')
        if (-not $script.Success) { throw 'Halaman tidak memuat JavaScript aplikasi.' }
        $asset = [Uri]::new([Uri]"$url/", $script.Groups[1].Value)
        $null = Invoke-WebRequest -Uri $asset.AbsoluteUri -UseBasicParsing -TimeoutSec 10
        $report = @{ Url=$url; Https=(-not $Http); Project=$project; ProcessId=$process.Id; Production=$production; CheckedAt=(Get-Date).ToString('o') }
        [IO.File]::WriteAllText((Join-Path $project '.kompack\start-report.json'), ($report | ConvertTo-Json), [Text.Encoding]::UTF8)
        if ($Lan -and $httpsInfo) {
            if (Get-NetTCPConnection -LocalPort ($Port-1) -State Listen -ErrorAction SilentlyContinue) { throw "Port panduan HP $($Port-1) sedang dipakai." }
            $enroll = Start-Process -FilePath $node -ArgumentList @('server/enroll.mjs') -WorkingDirectory $project -NoNewWindow -PassThru
        }
        if (-not $NoBrowser -and -not $SmokeTest) { Start-Process $url }
        Write-Host "Kompack siap: $url" -ForegroundColor Green
        Write-Host "Data bersama: $project\.kompack. Daftarkan perangkat pemilik pertama dahulu."
        if ($Lan) {
            Write-Host 'Izinkan Node pada jaringan Private jika Windows menampilkan dialog firewall.'
            $addresses = if ($httpsInfo) { $httpsInfo.Addresses } else { Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } | Select-Object -ExpandProperty IPAddress }
            foreach ($ip in $addresses) {
                Write-Host "HP (pasang sertifikat sekali): http://${ip}:$($Port-1)/"
                Write-Host "Aplikasi HP: ${scheme}://${ip}:$Port/"
            }
            if ($httpsInfo) { Write-Host "Sidik CA SHA-256: $($httpsInfo.Fingerprint)" }
        }
        if ($SmokeTest) { return }
        Write-Host 'Biarkan terminal ini terbuka. Tutup server dengan Ctrl+C.'
        $process.WaitForExit()
    } finally {
        if ($enroll -and -not $enroll.HasExited) { Stop-Process -Id $enroll.Id }
        if (-not $process.HasExited) { Stop-Process -Id $process.Id }
    }
} finally { Pop-Location }
