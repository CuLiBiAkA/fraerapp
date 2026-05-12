param(
    [switch]$WithMail,
    [switch]$ForceRecreate
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
    param(
        [string]$Title,
        [scriptblock]$Action
    )

    Write-Host ""
    Write-Host "== $Title ==" -ForegroundColor Cyan
    & $Action
}

$composeArgs = @("-f", "compose.yaml")
if ($WithMail) {
    if (-not (Test-Path -LiteralPath "compose.mail.yaml")) {
        throw "compose.mail.yaml not found"
    }
    $composeArgs += @("-f", "compose.mail.yaml")
}

Invoke-Step "Compose config" {
    & docker compose @composeArgs config --quiet
}

$upArgs = $composeArgs + @("up", "-d", "--build")
if ($ForceRecreate) {
    $upArgs += "--force-recreate"
}

Invoke-Step "Start containers" {
    & docker compose @upArgs
}

Invoke-Step "Container status" {
    & docker compose @composeArgs ps
}

Invoke-Step "Local health" {
    if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
        & curl.exe --noproxy "*" -I --connect-timeout 5 http://127.0.0.1/healthz
    } else {
        Write-Warning "curl.exe not found; open http://127.0.0.1/healthz manually"
    }
}

Write-Host ""
Write-Host "FraerApp start command finished."
