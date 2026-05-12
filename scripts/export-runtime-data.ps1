param(
    [string]$BackupRoot = ".\backups",
    [string]$ProjectName = "fraerapp",
    [switch]$IncludeMail,
    [string]$TarImage = "postgres:16-alpine"
)

$ErrorActionPreference = "Stop"

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

function Export-Volume {
    param(
        [string]$VolumeName,
        [string]$FileName
    )

    Invoke-Checked "Export volume $VolumeName" {
        & docker volume inspect $VolumeName *> $null
        if ($LASTEXITCODE -ne 0) {
            throw "Docker volume not found: $VolumeName"
        }
        & docker run --rm -v "${VolumeName}:/data:ro" -v "${BackupFullPath}:/backup" $TarImage sh -c "cd /data && tar czf /backup/$FileName ."
    }
}

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupPath = Join-Path $BackupRoot "fraerapp-runtime-$stamp"
New-Item -ItemType Directory -Force -Path $backupPath | Out-Null
$BackupFullPath = (Resolve-Path -LiteralPath $backupPath).Path

$composeArgs = @("-f", "compose.yaml")
if ($IncludeMail) {
    $composeArgs += @("-f", "compose.mail.yaml")
}

Invoke-Checked "Show containers" {
    & docker compose @composeArgs ps
}

Invoke-Checked "Dump main PostgreSQL" {
    & docker compose @composeArgs exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/fraerapp.dump'
}

Invoke-Checked "Copy main PostgreSQL dump" {
    & docker compose @composeArgs cp postgres:/tmp/fraerapp.dump (Join-Path $BackupFullPath "fraerapp.dump")
}

Invoke-Checked "Dump auth PostgreSQL" {
    & docker compose @composeArgs exec -T auth-postgres sh -lc 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/fraerapp_auth.dump'
}

Invoke-Checked "Copy auth PostgreSQL dump" {
    & docker compose @composeArgs cp auth-postgres:/tmp/fraerapp_auth.dump (Join-Path $BackupFullPath "fraerapp_auth.dump")
}

Export-Volume -VolumeName "${ProjectName}_story-uploads" -FileName "story-uploads.tgz"

if ($IncludeMail) {
    Export-Volume -VolumeName "${ProjectName}_mail-data" -FileName "mail-data.tgz"
    Export-Volume -VolumeName "${ProjectName}_mail-state" -FileName "mail-state.tgz"
    Export-Volume -VolumeName "${ProjectName}_mail-logs" -FileName "mail-logs.tgz"
    Export-Volume -VolumeName "${ProjectName}_mail-config" -FileName "mail-config.tgz"
}

$manifest = @(
    "FraerApp runtime backup",
    "Created: $(Get-Date -Format o)",
    "ProjectName: $ProjectName",
    "IncludeMail: $IncludeMail",
    "Files:",
    "  fraerapp.dump",
    "  fraerapp_auth.dump",
    "  story-uploads.tgz"
)

if ($IncludeMail) {
    $manifest += @(
        "  mail-data.tgz",
        "  mail-state.tgz",
        "  mail-logs.tgz",
        "  mail-config.tgz"
    )
}

Set-Content -LiteralPath (Join-Path $BackupFullPath "manifest.txt") -Value $manifest -Encoding UTF8

Write-Host ""
Write-Host "Backup created: $BackupFullPath" -ForegroundColor Green
