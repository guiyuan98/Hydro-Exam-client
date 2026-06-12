param(
    [string]$InstallDir = "C:\OJ\OnlineJudgeDeploy",
    [string]$PublicHost = "http://127.0.0.1",
    [string]$DeployRepo = "https://github.com/QingdaoU/OnlineJudgeDeploy.git",
    [string]$DeployBranch = "2.0",
    [switch]$Update
)

$ErrorActionPreference = "Stop"

function Require-Command($Name, $InstallHint) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Command not found: $Name. $InstallHint"
    }
}

Require-Command git "Please install Git first."
Require-Command docker "Please install Docker Desktop or Docker Engine first."

$parent = Split-Path -Parent $InstallDir
if (-not (Test-Path $parent)) {
    New-Item -ItemType Directory -Path $parent | Out-Null
}

if (-not (Test-Path $InstallDir)) {
    git clone -b $DeployBranch $DeployRepo $InstallDir
} elseif ($Update) {
    Push-Location $InstallDir
    try {
        git fetch origin
        git checkout $DeployBranch
        git pull --ff-only
    } finally {
        Pop-Location
    }
}

Push-Location $InstallDir
try {
    if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
        docker-compose up -d
    } else {
        docker compose up -d
    }

    Write-Host ""
    Write-Host "OnlineJudge startup command finished."
    Write-Host "Public URL: $PublicHost"
    Write-Host ('Next: .\deploy\create-super-admin.ps1 -InstallDir "{0}" -Username admin -Password "Admin@123456"' -f $InstallDir)
} finally {
    Pop-Location
}
