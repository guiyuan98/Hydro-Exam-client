param(
    [string]$Distro = "Ubuntu-26.04-E"
)

$ErrorActionPreference = "Stop"

function Invoke-WslRoot {
    param([string]$Command)
    wsl -d $Distro -u root -- bash -lc $Command
}

Write-Host "Starting Hydro OJ services in WSL distro: $Distro"
Invoke-WslRoot "export PATH=/root/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin; pm2 resurrect || pm2 restart all || true; pm2 list"

Write-Host ""
Write-Host "Local test URLs:"
Write-Host "  http://localhost/"
Write-Host "  http://localhost:8888/"

