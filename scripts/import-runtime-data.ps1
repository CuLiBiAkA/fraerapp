param(
    [Parameter(Mandatory = $true)]
    [string]$BackupPath,
    [string]$ProjectName = "fraerapp",
    [switch]$IncludeMail,
    [switch]$Force,
    [string]$TarImage = "postgres:16-alpine"
)

$ErrorActionPreference = "Stop"

if (-not $Force) {
    Write-Host "This restore replaces database contents and selected Docker volumes." -ForegroundColor Yellow
    Write-Host "Re-run with -Force when you are sure this is the new target machine."
    exit 2
}

function Invoke-Checked {
    param(
        [string]$Title,
        [scriptblock]$Action
    )

    Write-Host ""
    Write-Host "== $Title ==" -ForegroundColor Cyan
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw "Step failed: $Title"
    }
}

function Wait-ComposeServiceHealthy {
    param([string]$Service)

    Write-Host "Waiting for $Service health..."
    for ($i = 0; $i -lt 60; $i++) {
        $containerId = (& docker compose -f compose.yaml ps -q $Service)
        if ($LASTEXITCODE -eq 0 -and $containerId) {
            $health = (& docker inspect --format "{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}" $containerId 2>$null)
            if ($health -eq "healthy" -or $health -eq "running") {
                Write-Host "$Service is $health"
                return
            }
        }
        Start-Sleep -Seconds 2
    }

    throw "$Service did not become healthy"
}

function Import-Volume {
    param(
        [string]$VolumeName,
        [string]$FileName
    )

    $source = Join-Path $BackupFullPath $FileName
    if (-not (Test-Path -LiteralPath $source)) {
        throw "Backup file not found: $source"
    }

    Invoke-Checked "Import volume $VolumeName" {
        & docker volume create $VolumeName *> $null
        & docker run --rm -v "${VolumeName}:/data" -v "${BackupFullPath}:/backup:ro" $TarImage sh -c "rm -rf /data/* /data/.[!.]* /data/..?* 2>/dev/null || true; tar xzf /backup/$FileName -C /data"
    }
}

$BackupFullPath = (Resolve-Path -LiteralPath $BackupPath).Path

foreach ($file in @("fraerapp.dump", "fraerapp_auth.dump", "story-uploads.tgz")) {
    if (-not (Test-Path -LiteralPath (Join-Path $BackupFullPath $file))) {
        throw "Backup file not found: $file"
    }
}

Invoke-Checked "Start database containers" {
    & docker compose -f compose.yaml up -d postgres auth-postgres
}

Wait-ComposeServiceHealthy -Service "postgres"
Wait-ComposeServiceHealthy -Service "auth-postgres"

Invoke-Checked "Copy main PostgreSQL dump" {
    & docker compose -f compose.yaml cp (Join-Path $BackupFullPath "fraerapp.dump") postgres:/tmp/fraerapp.dump
}

Invoke-Checked "Restore main PostgreSQL" {
    & docker compose -f compose.yaml exec -T postgres sh -lc 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner /tmp/fraerapp.dump'
}

Invoke-Checked "Copy auth PostgreSQL dump" {
    & docker compose -f compose.yaml cp (Join-Path $BackupFullPath "fraerapp_auth.dump") auth-postgres:/tmp/fraerapp_auth.dump
}

Invoke-Checked "Restore auth PostgreSQL" {
    & docker compose -f compose.yaml exec -T auth-postgres sh -lc 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner /tmp/fraerapp_auth.dump'
}

Import-Volume -VolumeName "${ProjectName}_story-uploads" -FileName "story-uploads.tgz"

if ($IncludeMail) {
    foreach ($file in @("mail-data.tgz", "mail-state.tgz", "mail-logs.tgz", "mail-config.tgz")) {
        if (-not (Test-Path -LiteralPath (Join-Path $BackupFullPath $file))) {
            throw "Mail backup file not found: $file"
        }
    }

    & docker compose -f compose.yaml -f compose.mail.yaml stop mailserver 2>$null
    Import-Volume -VolumeName "${ProjectName}_mail-data" -FileName "mail-data.tgz"
    Import-Volume -VolumeName "${ProjectName}_mail-state" -FileName "mail-state.tgz"
    Import-Volume -VolumeName "${ProjectName}_mail-logs" -FileName "mail-logs.tgz"
    Import-Volume -VolumeName "${ProjectName}_mail-config" -FileName "mail-config.tgz"
}

Write-Host ""
Write-Host "Restore complete. Start the stack with scripts\start-production.ps1 -WithMail" -ForegroundColor Green
