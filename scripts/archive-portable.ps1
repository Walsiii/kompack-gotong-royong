param([string]$SourceDir, [string]$OutputZip)
$ErrorActionPreference = 'Stop'
Compress-Archive -LiteralPath $SourceDir -DestinationPath $OutputZip -CompressionLevel Optimal -Force
