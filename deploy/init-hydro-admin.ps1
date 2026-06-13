param(
    [string]$Distro = "Ubuntu-26.04-E",
    [string]$BaseUrl = "http://localhost",
    [string]$Email = "guiyuan98@foxmail.com",
    [string]$Username = "admin",
    [string]$Password = "Admin@123456"
)

$ErrorActionPreference = "Stop"

Write-Host "Registering Hydro admin account through $BaseUrl"
$mail = [uri]::EscapeDataString($Email)
$response = curl.exe --noproxy "*" -i -s -X POST "$BaseUrl/register" -H "Content-Type: application/x-www-form-urlencoded" --data "mail=$mail"
$location = ($response -split "`r?`n" | Where-Object { $_ -match "^Location:\s*(.+)$" } | Select-Object -First 1)
if (-not $location) {
    throw "Hydro did not return a register redirect. The account may already exist."
}

$registerPath = ($location -replace "^Location:\s*", "").Trim()
$code = Split-Path $registerPath -Leaf
$body = "uname=$([uri]::EscapeDataString($Username))&password=$([uri]::EscapeDataString($Password))&verifyPassword=$([uri]::EscapeDataString($Password))&code=$([uri]::EscapeDataString($code))"
curl.exe --noproxy "*" -i -s -X POST "$BaseUrl$registerPath" -H "Content-Type: application/x-www-form-urlencoded" --data $body | Out-Null

Write-Host "Promoting UID 2 to super admin."
wsl -d $Distro -u root -- bash -lc "export PATH=/root/.nix-profile/bin:/usr/local/bin:/usr/bin:/bin; hydrooj cli user setSuperAdmin 2; pm2 restart hydrooj"

Write-Host "Hydro super admin is ready:"
Write-Host "  username: $Username"
Write-Host "  email:    $Email"

