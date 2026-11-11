function Initialize-KompackHttps([string]$Project) {
    $ErrorActionPreference = 'Stop'
    $folder = Join-Path $Project '.kompack\tls'
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    $account = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls.exe $folder /inheritance:r /grant:r "${account}:(OI)(CI)F" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Folder kunci HTTPS tidak dapat diamankan.' }
    $settingsPath = Join-Path $folder 'settings.json'
    $settings = if (Test-Path -LiteralPath $settingsPath) { Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json } else { $null }
    $ips = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.AddressState -eq 'Preferred' } | Select-Object -ExpandProperty IPAddress | Sort-Object -Unique)
    $hosts = (@('127.0.0.1', '::1') + $ips | Sort-Object -Unique) -join ','
    $root = if ($settings) { Get-Item -LiteralPath "Cert:\CurrentUser\My\$($settings.RootThumbprint)" -ErrorAction SilentlyContinue } else { $null }
    if (-not $root -or $root.NotAfter -lt (Get-Date).AddDays(100)) {
        $root = New-SelfSignedCertificate -Type Custom -Subject 'CN=Kompack Local HTTPS CA' -FriendlyName 'Kompack Local HTTPS CA' -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -KeyExportPolicy NonExportable -KeyUsage CertSign,CRLSign,DigitalSignature -TextExtension @('2.5.29.19={critical}{text}ca=1&pathlength=0') -CertStoreLocation 'Cert:\CurrentUser\My' -NotAfter (Get-Date).AddYears(2)
        $settings = $null
    }
    $cer = Join-Path $folder 'Kompack-CA.cer'
    Export-Certificate -Cert $root -FilePath $cer -Force | Out-Null
    if (-not (Test-Path -LiteralPath "Cert:\CurrentUser\Root\$($root.Thumbprint)")) {
        Write-Host 'Memasang CA lokal Kompack pada akun Windows ini agar HTTPS dipercaya.'
        Import-Certificate -FilePath $cer -CertStoreLocation 'Cert:\CurrentUser\Root' | Out-Null
    }
    $pem = Join-Path $folder 'Kompack-CA.pem'
    $pemText = "-----BEGIN CERTIFICATE-----`n" + [Convert]::ToBase64String($root.RawData, [Base64FormattingOptions]::InsertLineBreaks) + "`n-----END CERTIFICATE-----`n"
    [IO.File]::WriteAllText($pem, $pemText, [Text.Encoding]::ASCII)
    $pfx = Join-Path $folder 'localhost.pfx'
    $leaf = if ($settings) { Get-Item -LiteralPath "Cert:\CurrentUser\My\$($settings.LeafThumbprint)" -ErrorAction SilentlyContinue } else { $null }
    if (-not $leaf -or $leaf.NotAfter -lt (Get-Date).AddDays(7) -or $settings.Hosts -ne $hosts -or -not (Test-Path -LiteralPath $pfx)) {
        $san = '2.5.29.17={text}DNS=localhost' + ((@('127.0.0.1', '::1') + $ips | Sort-Object -Unique | ForEach-Object { "&IPAddress=$_" }) -join '')
        $leaf = New-SelfSignedCertificate -Type Custom -Subject 'CN=localhost' -FriendlyName 'Kompack HTTPS server' -Signer $root -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -KeyExportPolicy Exportable -KeyUsage DigitalSignature,KeyEncipherment -TextExtension @($san, '2.5.29.37={text}1.3.6.1.5.5.7.3.1', '2.5.29.19={critical}{text}ca=0') -CertStoreLocation 'Cert:\CurrentUser\My' -NotAfter (Get-Date).AddDays(90)
        $bytes = New-Object byte[] 32
        $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
        try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
        $password = [Convert]::ToBase64String($bytes)
        Export-PfxCertificate -Cert $leaf -FilePath $pfx -Password (ConvertTo-SecureString $password -AsPlainText -Force) -ChainOption EndEntityCertOnly -CryptoAlgorithmOption AES256_SHA256 -Force | Out-Null
        $settings = [pscustomobject]@{ RootThumbprint=$root.Thumbprint; LeafThumbprint=$leaf.Thumbprint; Hosts=$hosts; Password=$password }
        [IO.File]::WriteAllText($settingsPath, ($settings | ConvertTo-Json), [Text.Encoding]::UTF8)
    }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $fingerprint = ([BitConverter]::ToString($sha.ComputeHash($root.RawData))).Replace('-',':') } finally { $sha.Dispose() }
    return [pscustomobject]@{ Pfx=$pfx; Password=$settings.Password; RootCer=$cer; RootPem=$pem; Fingerprint=$fingerprint; Addresses=$ips }
}
