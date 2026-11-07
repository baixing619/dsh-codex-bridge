$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$version = (Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json).version
$folder = 'dsh-codex-bridge-v' + $version
$zipPath = Join-Path $repoRoot ('dist/' + $folder + '.zip')
$expected = @(
  'bridge.mjs'
  'plugin.mjs'
  'client.mjs'
  'Install.ps1'
  'README.md'
  'LICENSE'
  'skills/dsh-message-bridge/SKILL.md'
  'skills/dsh-message-bridge/scripts/client.mjs'
)
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [IO.Compression.ZipFile]::OpenRead($zipPath)
try {
  $files = @($archive.Entries | Where-Object { -not $_.FullName.Replace('\','/').EndsWith('/') })
  $names = @($files | ForEach-Object { $_.FullName.Replace('\','/') })
  $expectedNames = @($expected | ForEach-Object { $folder + '/' + $_ })
  if (@(Compare-Object ($expectedNames | Sort-Object) ($names | Sort-Object)).Count -ne 0) {
    throw 'Release archive does not match the runtime-only file list'
  }
  foreach ($entry in $files) {
    $path = $entry.FullName.Replace('\','/').Substring($folder.Length + 1)
    $sourceHash = (Get-FileHash -LiteralPath (Join-Path $repoRoot $path) -Algorithm SHA256).Hash
    $stream = $entry.Open()
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { $archiveHash = [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-','') }
    finally { $hasher.Dispose(); $stream.Dispose() }
    if ($archiveHash -ne $sourceHash) { throw ('Release content mismatch: ' + $path) }
  }
} finally { $archive.Dispose() }
$zipHash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash.ToLowerInvariant()
$checksum = [IO.File]::ReadAllText((Join-Path $repoRoot 'dist/SHA256SUMS.txt')).Trim()
if ($checksum -ne ($zipHash + '  ' + $folder + '.zip')) { throw 'Release checksum mismatch' }
Write-Output 'Release ZIP passed: exact runtime-only files, source bytes, and checksum.'
