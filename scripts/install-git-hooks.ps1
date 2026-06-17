$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repoRoot ".githooks\prepare-commit-msg"
$destDir = Join-Path $repoRoot ".git\hooks"
$dest = Join-Path $destDir "prepare-commit-msg"

if (-not (Test-Path $source)) {
  Write-Error "Missing hook template: $source"
}

New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Copy-Item -Force $source $dest
Write-Host "Installed prepare-commit-msg hook to $dest"
