param(
    [string]$Target = 'G:\Hackathon\Kompack!',
    [switch]$NoStart
)
$ErrorActionPreference = 'Stop'
function Run-Checked([string]$Program, [string[]]$Arguments) {
    & $Program @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Program gagal (exit $LASTEXITCODE)." }
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { throw 'Pasang Git for Windows terlebih dahulu: https://git-scm.com/download/win' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Pasang Node.js 24 LTS terlebih dahulu: https://nodejs.org/' }
$nodeVersion = & node --version
if ($LASTEXITCODE -ne 0 -or ([version]($nodeVersion -replace '^v', '')) -lt [version]'22.12.0') { throw 'Gunakan Node.js 24 LTS atau versi >=22.12.' }
$Target = [System.IO.Path]::GetFullPath($Target)
if ((Test-Path -LiteralPath $Target) -and (@(Get-ChildItem -LiteralPath $Target -Force).Count -gt 0)) {
    if (-not (Test-Path -LiteralPath (Join-Path $Target '.git'))) { throw "Folder $Target sudah ada dan bukan checkout Kompack. File lama tidak ditimpa." }
    $origin = & git -C $Target remote get-url origin
    if ($LASTEXITCODE -ne 0 -or $origin -notmatch '^https://github\.com/Walsiii/gotong-royong-(\.git)?/?$') { throw 'Origin folder tujuan berbeda. File lama tidak diubah.' }
    $dirty = & git -C $Target status --porcelain
    if ($LASTEXITCODE -ne 0 -or $dirty) { throw 'Ada perubahan lokal di folder tujuan. Simpan/commit perubahan itu sebelum update.' }
    $branch = & git -C $Target branch --show-current
    if ($branch -ne 'claude/hackathon-multiplatform-app-qhsbtv') { throw 'Branch lokal berbeda; installer tidak mengganti branch secara paksa.' }
    Run-Checked git @('-C', $Target, 'pull', '--ff-only', 'origin', 'claude/hackathon-multiplatform-app-qhsbtv')
} else {
    $parent = Split-Path -Parent $Target
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
    Run-Checked git @('clone', '--branch', 'claude/hackathon-multiplatform-app-qhsbtv', '--single-branch', 'https://github.com/Walsiii/gotong-royong-.git', $Target)
}
Push-Location -LiteralPath $Target
try {
    Run-Checked npm.cmd @('ci', '--no-audit', '--no-fund')
    Run-Checked npm.cmd @('run', 'test:routing')
    Run-Checked npm.cmd @('run', 'test:realtime')
    Run-Checked npm.cmd @('run', 'build')
    Write-Host "Kompack siap di $Target" -ForegroundColor Green
    if (-not $NoStart) { & (Join-Path $Target 'scripts\Start-Kompack.ps1') }
} finally { Pop-Location }
