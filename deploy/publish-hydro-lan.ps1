param(
    [string]$Distro = "Ubuntu-26.04-E",
    [int]$HttpPort = 80
)

$ErrorActionPreference = "Stop"

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    throw "Please run this script from an elevated PowerShell window."
}

$wslIp = (wsl -d $Distro -u root -- bash -lc "hostname -I | awk '{print `$1}'").Trim()
if (-not $wslIp) {
    throw "Unable to detect WSL IP address."
}

Write-Host "Publishing Windows 0.0.0.0:$HttpPort to WSL $wslIp:80"
netsh interface portproxy delete v4tov4 listenaddress=0.0.0.0 listenport=$HttpPort 2>$null | Out-Null
netsh interface portproxy add v4tov4 listenaddress=0.0.0.0 listenport=$HttpPort connectaddress=$wslIp connectport=80
netsh advfirewall firewall add rule name="GYOJ Hydro HTTP $HttpPort" dir=in action=allow protocol=TCP localport=$HttpPort | Out-Null

$lanIp = (Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.254.*" -and $_.IPAddress -notlike "172.*" } |
    Select-Object -First 1 -ExpandProperty IPAddress)

Write-Host "Hydro LAN URL:"
Write-Host "  http://$lanIp/"
netsh interface portproxy show all

