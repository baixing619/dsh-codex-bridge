$ErrorActionPreference='Stop'
$repoRoot=Split-Path $PSScriptRoot -Parent
$testRoot=Join-Path ([IO.Path]::GetTempPath()) ('dsh install fixture '+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path (Join-Path $testRoot 'profiles/web') -Force | Out-Null
$patch=Join-Path $testRoot 'profiles/web/cordis.patch.yml'
$before="- id: unrelated-fixture`r`n"
[IO.File]::WriteAllText($patch,$before)
try {
 & (Join-Path $repoRoot 'Install.ps1') -SessionId 'session-fixture-only' -DshHome $testRoot
 $updated=[IO.File]::ReadAllText($patch)
 if(-not $updated.StartsWith($before.TrimEnd())){throw 'Existing config changed'}
 if($updated -notmatch 'codex-local-message-bridge'){throw 'Bridge config missing'}
 $backups=@(Get-ChildItem -LiteralPath (Join-Path $testRoot 'profiles/local-message-bridge/backups') -File)
 if($backups.Count -ne 1 -or [IO.File]::ReadAllText($backups[0].FullName) -ne $before){throw 'Protected backup mismatch'}
 foreach($name in @('bridge.mjs','plugin.mjs')){
   $copy=Join-Path $testRoot ('profiles/plugins/codex-local-message-bridge/'+$name)
   if((Get-FileHash -LiteralPath $copy).Hash -ne (Get-FileHash -LiteralPath (Join-Path $repoRoot $name)).Hash){throw 'Installed source mismatch'}
 }
 $rejected=$false
 try {& (Join-Path $repoRoot 'Install.ps1') -SessionId 'session-another-fixture' -DshHome $testRoot} catch {$rejected=$true}
 if(-not $rejected -or [IO.File]::ReadAllText($patch) -ne $updated){throw 'Duplicate install changed config'}
 Write-Output 'Installer fixture passed: fresh path, preserved config, protected backup, exact modules, duplicate refusal.'
} finally {
 $resolved=[IO.Path]::GetFullPath($testRoot)
 $tempRoot=[IO.Path]::GetFullPath([IO.Path]::GetTempPath())
 if(-not $resolved.StartsWith($tempRoot,[StringComparison]::OrdinalIgnoreCase)){throw 'Refusing out-of-temp cleanup'}
 Remove-Item -LiteralPath $resolved -Recurse -Force
}
