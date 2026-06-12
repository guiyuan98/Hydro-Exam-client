param(
    [int]$HttpPort = 80,
    [int]$HttpsPort = 443
)

$ErrorActionPreference = "Stop"

netsh advfirewall firewall add rule name="GYOJ OnlineJudge HTTP $HttpPort" dir=in action=allow protocol=TCP localport=$HttpPort
netsh advfirewall firewall add rule name="GYOJ OnlineJudge HTTPS $HttpsPort" dir=in action=allow protocol=TCP localport=$HttpsPort

Write-Host "Firewall rules added for ports $HttpPort and $HttpsPort."
