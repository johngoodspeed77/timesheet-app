# Create GitHub repository for Timesheet App
# Prerequisites: gh auth login (https://cli.github.com)

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot/..

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "GitHub CLI (gh) is not installed. Install from https://cli.github.com"
}

gh auth status 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Not logged in. Run: gh auth login --web --git-protocol https"
  exit 1
}

gh repo create timesheet-app `
  --public `
  --source=. `
  --remote=origin `
  --description "Weekly timesheet PWA — log hours and email your boss. Built on SupaDupaBase." `
  --push

git push --tags

Write-Host ""
Write-Host "Done. Repository: https://github.com/$(gh api user -q .login)/timesheet-app"
