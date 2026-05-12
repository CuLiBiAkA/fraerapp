param(
    [int[]]$Ports = @(80, 443, 8090)
)

$ErrorActionPreference = "Continue"

function Write-Section {
    param([string]$Title)
    Write-Host ""
    Write-Host "== $Title ==" -ForegroundColor Cyan
}

function Write-Ok {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Write-Warn {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Write-Bad {
    param([string]$Message)
    Write-Host "[FAIL] $Message" -ForegroundColor Red
}

Write-Host "FraerApp new PC preflight. This script does not change network, firewall, Docker, or files."

Write-Section "Files"
$required = @(
    "compose.yaml",
    "nginx\nginx.conf",
    ".env",
    "nginx\certs\fraerapp.fullchain.crt",
    "nginx\certs\fraerapp.key"
)

foreach ($path in $required) {
    if (Test-Path -LiteralPath $path) {
        Write-Ok "$path exists"
    } else {
        Write-Bad "$path is missing"
    }
}

if (Test-Path -LiteralPath "compose.mail.yaml") {
    Write-Ok "compose.mail.yaml exists"
} else {
    Write-Warn "compose.mail.yaml is missing; mailserver will be skipped"
}

if (Test-Path -LiteralPath "mailserver.env") {
    Write-Ok "mailserver.env exists"
} else {
    Write-Warn "mailserver.env is missing; required only for local mailserver"
}

Write-Section "Docker"
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Bad "Docker CLI is not installed or not in PATH"
} else {
    $dockerVersion = (& docker version --format "{{.Server.Version}}" 2>$null)
    if ($LASTEXITCODE -eq 0 -and $dockerVersion) {
        Write-Ok "Docker engine is available: $dockerVersion"
    } else {
        Write-Bad "Docker CLI exists, but Docker engine is not reachable"
    }

    $composeVersion = (& docker compose version 2>$null)
    if ($LASTEXITCODE -eq 0 -and $composeVersion) {
        Write-Ok $composeVersion
    } else {
        Write-Bad "Docker Compose plugin is not reachable"
    }

    & docker compose -f compose.yaml config --quiet 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Ok "compose.yaml is valid"
    } else {
        Write-Bad "compose.yaml validation failed"
    }
}

Write-Section "Listening ports"
$listeners = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $Ports -contains $_.LocalPort }
foreach ($port in $Ports) {
    $portListeners = $listeners | Where-Object { $_.LocalPort -eq $port }
    if ($portListeners) {
        foreach ($listener in $portListeners) {
            $processName = "unknown"
            try {
                $processName = (Get-Process -Id $listener.OwningProcess -ErrorAction Stop).ProcessName
            } catch {
                $processName = "pid $($listener.OwningProcess)"
            }
            Write-Warn "Port $port is already listening on $($listener.LocalAddress), process: $processName"
        }
    } else {
        Write-Ok "Port $port is free before Docker start"
    }
}

Write-Section "Network"
try {
    $ipConfigs = Get-NetIPConfiguration -ErrorAction Stop | Where-Object { $_.IPv4DefaultGateway -and $_.IPv4Address }
    foreach ($cfg in $ipConfigs) {
        $ips = ($cfg.IPv4Address | ForEach-Object { $_.IPAddress }) -join ", "
        $gateways = ($cfg.IPv4DefaultGateway | ForEach-Object { $_.NextHop }) -join ", "
        Write-Host "Interface: $($cfg.InterfaceAlias); IPv4: $ips; Gateway: $gateways"
    }
} catch {
    Write-Warn "Could not inspect IP configuration. Try running PowerShell as Administrator if needed."
}

try {
    $defaultRoutes = Get-NetRoute -DestinationPrefix "0.0.0.0/0" -ErrorAction Stop | Sort-Object RouteMetric
    foreach ($route in $defaultRoutes) {
        Write-Host "Default route: ifIndex=$($route.InterfaceIndex) nextHop=$($route.NextHop) metric=$($route.RouteMetric)"
    }
} catch {
    Write-Warn "Could not inspect default routes. Try running PowerShell as Administrator if needed."
}

try {
    $vpnAdapters = Get-NetAdapter -ErrorAction Stop | Where-Object {
        $_.InterfaceDescription -match "WireGuard|Amnezia|VPN|Check Point" -or $_.Name -match "WireGuard|Amnezia|VPN|Check Point"
    }

    if ($vpnAdapters) {
        foreach ($adapter in $vpnAdapters) {
            Write-Warn "VPN-like adapter detected: $($adapter.Name) / $($adapter.InterfaceDescription) / $($adapter.Status)"
        }
        Write-Warn "For public port forwarding, avoid full-tunnel VPN on the server PC or configure split tunneling."
    } else {
        Write-Ok "No obvious VPN-like adapter detected"
    }
} catch {
    Write-Warn "Could not inspect network adapters. Try running PowerShell as Administrator if needed."
}

Write-Section "Local DNS"
try {
    Resolve-DnsName fraerapp.ru -ErrorAction Stop | Where-Object { $_.Type -eq "A" } | ForEach-Object {
        Write-Host "fraerapp.ru -> $($_.IPAddress) TTL=$($_.TTL)"
    }
} catch {
    Write-Warn "Could not resolve fraerapp.ru with local DNS"
}

Write-Host ""
Write-Host "Preflight complete."
