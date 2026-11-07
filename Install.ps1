#Requires -Version 5.1
param(
  [Parameter(Mandatory=$true)][string]$SessionId,
  [string]$DshHome = $env:DSH_HOME
)
$ErrorActionPreference = 'Stop'
if ($SessionId -notmatch '^session-[a-zA-Z0-9-]+$') { throw 'Invalid DSH session ID.' }
if (-not $DshHome) { $DshHome = Join-Path $env:LOCALAPPDATA 'DSHDesktop\dsh-home' }
$profileRoot = Join-Path $DshHome 'profiles'
$patchPath = Join-Path $profileRoot 'web\cordis.patch.yml'
if (-not (Test-Path -LiteralPath $patchPath -PathType Leaf)) { throw 'DSH web profile not found. Supply -DshHome with your DSH data directory.' }
$original = [IO.File]::ReadAllText($patchPath)
if ($original -match 'id:\s*codex-local-message-bridge') { throw 'Bridge already installed. Do not install twice; inspect the existing plugin configuration.' }
$destination = Join-Path $profileRoot 'plugins\codex-local-message-bridge'
$stateDirectory = Join-Path $profileRoot 'local-message-bridge'
New-Item -ItemType Directory -Path $destination,$stateDirectory -Force | Out-Null
$accountSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls $stateDirectory /inheritance:r /grant:r "*${accountSid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Failed to protect the local bridge credential directory.' }
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'bridge.mjs'),(Join-Path $PSScriptRoot 'plugin.mjs') -Destination $destination
$backupDirectory = Join-Path $stateDirectory 'backups'
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$backup = Join-Path $backupDirectory ('cordis.patch.before-' + [guid]::NewGuid().ToString('N') + '.yml')
if (-not (Test-Path -LiteralPath $backup)) { Copy-Item -LiteralPath $patchPath -Destination $backup }
$addition = @"

- insert:
  - id: codex-local-message-bridge
    name: '../plugins/codex-local-message-bridge/plugin.mjs'
    config:
      sessionId: '$SessionId'
"@
$temporary = $patchPath + '.bridge-new'
[IO.File]::WriteAllText($temporary, $original.TrimEnd() + "`r`n" + $addition + "`r`n", [Text.UTF8Encoding]::new($false))
[IO.File]::Replace($temporary, $patchPath, $backup)
Write-Host 'Installed. DSH live patch reload should load the bridge. Check client.mjs status; a config change alone is not proof of readiness.'
