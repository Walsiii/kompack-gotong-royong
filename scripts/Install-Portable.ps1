param([string]$Target = 'G:\Hackathon\Kompack!', [switch]$NoStart)
$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path -LiteralPath (Join-Path $source 'portable.json'))) { throw 'Ekstrak seluruh ZIP Kompack terlebih dahulu.' }
$manifest = Get-Content -Raw -LiteralPath (Join-Path $source 'portable.json') | ConvertFrom-Json
Write-Host 'Memeriksa paket Kompack...'
foreach ($file in $manifest.files) {
    $relative = $file.path.Replace('/', [IO.Path]::DirectorySeparatorChar)
    $full = [IO.Path]::GetFullPath((Join-Path $source $relative))
    if (-not $full.StartsWith($source + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Path paket tidak valid.' }
    if ((Get-FileHash -LiteralPath $full -Algorithm SHA256).Hash -ne $file.sha256) { throw "Paket rusak: $relative. Unduh ZIP lagi." }
}
$Target = [IO.Path]::GetFullPath($Target)
if ($source -ne $Target) {
    if ((Test-Path -LiteralPath $Target) -and (@(Get-ChildItem -LiteralPath $Target -Force).Count -gt 0) -and -not (Test-Path -LiteralPath (Join-Path $Target 'portable.json'))) {
        $Target = Join-Path $Target 'Kompack-Local'
        Write-Host "Folder lama dipertahankan. Paket ditempatkan di $Target"
        if ((Test-Path -LiteralPath $Target) -and (@(Get-ChildItem -LiteralPath $Target -Force).Count -gt 0) -and -not (Test-Path -LiteralPath (Join-Path $Target 'portable.json'))) { throw 'Subfolder tujuan juga berisi file lain. File lama tidak ditimpa.' }
    }
    New-Item -ItemType Directory -Force -Path $Target | Out-Null
    foreach ($name in @('runtime','dist','server','scripts','Start-Kompack.cmd','Install-Kompack.cmd','portable.json','BACA-DULU.txt','THIRD-PARTY-LICENSES.txt')) {
        Copy-Item -LiteralPath (Join-Path $source $name) -Destination $Target -Recurse -Force
    }
}
Write-Host "Kompack terpasang di $Target" -ForegroundColor Green
if (-not $NoStart) { & (Join-Path $Target 'scripts\Start-Kompack.ps1') -Lan }
