param(
    [string]$Distro = "Ubuntu-26.04-E"
)

$ErrorActionPreference = "Stop"

function Invoke-WslRoot {
    param([string]$Command)
    wsl -d $Distro -u root -- bash -lc $Command
}

Write-Host "Installing Hydro OJ in WSL distro: $Distro"
Invoke-WslRoot "set -e; export DEBIAN_FRONTEND=noninteractive; apt-get update; apt-get install -y curl ca-certificates; export USER=root; LANG=zh bash -lc 'source <(curl -fsSL https://hydro.ac/setup.sh)'"

Write-Host "Hydro install command finished. Checking PM2 services..."
Invoke-WslRoot "export PATH=/root/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin; pm2 list"

