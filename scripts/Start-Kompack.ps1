param([switch]$Lan, [int]$Port = 5173)
$ErrorActionPreference = 'Stop'
if ($Port -lt 1024 -or $Port -gt 65535) { throw 'Port harus 1024-65535.' }
$project = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $project
try {
    if (-not (Test-Path 'node_modules')) { throw 'Jalankan Install-Kompack.ps1 terlebih dahulu.' }
    $existing = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($existing) { throw "Port $Port sedang dipakai. Gunakan -Port 5174 atau tutup server sebelumnya." }
    $scheme = if ($env:KOMPACK_TLS_CERT -and $env:KOMPACK_TLS_KEY) { 'https' } else { 'http' }
    $url = "${scheme}://localhost:$Port"
    $env:PORT = "$Port"
    $node = (Get-Command node).Source
    $arguments = @('server/local.mjs')
    if ($Lan) { $arguments += '--lan' }
    $process = Start-Process -FilePath $node -ArgumentList $arguments -WorkingDirectory $project -NoNewWindow -PassThru
    try {
        $ready = $false
        for ($i = 0; $i -lt 60; $i++) {
            if ($process.HasExited) { throw 'Server berhenti sebelum siap. Lihat pesan di terminal.' }
            try {
                $config = Invoke-RestMethod -Uri "$url/api/config" -TimeoutSec 2
                if ($config.service -eq 'kompack-local') { $ready = $true; break }
            } catch { Start-Sleep -Milliseconds 500 }
        }
        if (-not $ready) { throw 'Server belum siap. Periksa pesan di terminal.' }
        Start-Process $url
        Write-Host "Buka $url. Data bersama disimpan di $project\.kompack. Tutup dengan Ctrl+C." -ForegroundColor Green
        if ($Lan) {
            Write-Host 'Perangkat lain: buka http(s)://IP-PC:PORT di Wi-Fi yang sama. Izinkan firewall hanya untuk jaringan Private.'
            Write-Host 'Kamera/GPS HP memerlukan HTTPS dengan sertifikat tepercaya. HTTP LAN bisa dipakai untuk sinkronisasi data dan mode uji.'
            Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } | ForEach-Object { Write-Host "${scheme}://$($_.IPAddress):$Port" }
        }
        $process.WaitForExit()
    } finally {
        if (-not $process.HasExited) { Stop-Process -Id $process.Id }
    }
} finally { Pop-Location }
