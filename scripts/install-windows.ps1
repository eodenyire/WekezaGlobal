#Requires -Version 5.1
<#
.SYNOPSIS
    WekezaGlobal Infrastructure (WGI) — Windows Installer

.DESCRIPTION
    Bootstraps the WekezaGlobal developer stack on Windows using Docker Desktop.
    Checks all prerequisites, copies the environment template, and starts the
    full Docker Compose stack (PostgreSQL, Redis, Backend API, Frontend, MySQL,
    Prometheus, Grafana, Node Exporter).

.PARAMETER WithLogging
    Also start the optional ELK logging stack (Elasticsearch, Logstash, Kibana).

.PARAMETER SkipPrereqCheck
    Skip the prerequisite version checks (useful in CI/automated environments).

.EXAMPLE
    .\install-windows.ps1
    .\install-windows.ps1 -WithLogging
    .\install-windows.ps1 -SkipPrereqCheck

.NOTES
    Requires Docker Desktop for Windows with the WSL2 or Hyper-V backend.
    Run from the repository root or from the scripts\ sub-directory.
#>

[CmdletBinding()]
param(
    [switch]$WithLogging,
    [switch]$SkipPrereqCheck
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Resolve repository root ───────────────────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot  = if ((Split-Path -Leaf $ScriptDir) -eq "scripts") {
                 Split-Path -Parent $ScriptDir
             } else {
                 $ScriptDir
             }

# ── Helper functions ──────────────────────────────────────────────────────────
function Write-Header { param([string]$Text)
    Write-Host ""
    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host "============================================================" -ForegroundColor Cyan
}
function Write-Step { param([string]$Step, [string]$Text)
    Write-Host ""
    Write-Host "[$Step] $Text" -ForegroundColor Yellow
}
function Write-OK   { param([string]$Text) Write-Host "  [OK]    $Text" -ForegroundColor Green }
function Write-Info { param([string]$Text) Write-Host "  [INFO]  $Text" -ForegroundColor Cyan  }
function Write-Warn { param([string]$Text) Write-Host "  [WARN]  $Text" -ForegroundColor Yellow }
function Write-Err  { param([string]$Text) Write-Host "  [ERROR] $Text" -ForegroundColor Red   }

# ── Prerequisite check ────────────────────────────────────────────────────────
function Test-Prerequisites {
    Write-Step "PRE" "Checking prerequisites..."
    $missing = @()

    if (Get-Command docker -ErrorAction SilentlyContinue) {
        Write-OK "Docker: $(docker --version)"
    } else {
        Write-Err "Docker is not installed."
        Write-Info "Download from: https://www.docker.com/products/docker-desktop/"
        $missing += "Docker"
    }

    $dcOk = $false
    if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
        Write-OK "Docker Compose (standalone): $(docker-compose --version)"
        $dcOk = $true
    } elseif ((docker compose version 2>&1) -match "Docker Compose") {
        Write-OK "Docker Compose (plugin): $(docker compose version)"
        $dcOk = $true
    }
    if (-not $dcOk) {
        Write-Err "Docker Compose not found. Install Docker Desktop."
        $missing += "Docker Compose"
    }

    if (Get-Command git -ErrorAction SilentlyContinue) {
        Write-OK "Git: $(git --version)"
    } else {
        Write-Warn "Git not found (optional if repo already cloned)."
        Write-Info "Download from: https://git-scm.com/download/win"
    }

    if ($missing.Count -gt 0) {
        Write-Err "Missing required tools: $($missing -join ', ')"
        exit 1
    }
    Write-OK "All prerequisites satisfied."
}

function Test-DockerRunning {
    Write-Step "DOCKER" "Verifying Docker daemon is running..."
    try { $null = docker info 2>&1; Write-OK "Docker daemon is running." }
    catch {
        Write-Err "Docker daemon is not running. Start Docker Desktop and retry."
        exit 1
    }
}

# ── Environment setup ─────────────────────────────────────────────────────────
function Initialize-Env {
    Write-Step "ENV" "Setting up environment variables..."
    $envFile    = Join-Path $RepoRoot ".env"
    $envExample = Join-Path $RepoRoot ".env.example"
    if (-not (Test-Path $envFile)) {
        if (Test-Path $envExample) {
            Copy-Item $envExample $envFile
            Write-OK ".env created from .env.example"
            Write-Warn "Review $envFile and update secrets before production use."
        } else {
            Write-Err ".env.example not found at: $envExample"
            exit 1
        }
    } else {
        Write-Info ".env already exists — skipping copy."
    }
}

# ── Compose helper ────────────────────────────────────────────────────────────
function Invoke-DockerCompose {
    param([string[]]$Arguments)
    $orig = Get-Location
    Set-Location $RepoRoot
    try {
        if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
            & docker-compose @Arguments
        } else {
            & docker compose @Arguments
        }
        if ($LASTEXITCODE -ne 0) { throw "docker compose exited with code $LASTEXITCODE" }
    } finally { Set-Location $orig }
}

# ── Pull / Build / Start ──────────────────────────────────────────────────────
function Get-Images {
    Write-Step "1/3" "Pulling Docker images..."
    if ($WithLogging) { Invoke-DockerCompose @("--profile","logging","pull","--quiet") }
    else              { Invoke-DockerCompose @("pull","--quiet") }
    Write-OK "Images pulled."
}

function Build-Images {
    Write-Step "2/3" "Building backend and frontend images..."
    Invoke-DockerCompose @("build","--parallel")
    Write-OK "Images built."
}

function Start-Services {
    Write-Step "3/3" "Starting all services..."
    if ($WithLogging) { Invoke-DockerCompose @("--profile","logging","up","-d") }
    else              { Invoke-DockerCompose @("up","-d") }
    Write-OK "Services started."
}

# ── Health wait ───────────────────────────────────────────────────────────────
function Wait-ForHealth {
    Write-Step "WAIT" "Waiting for services to become healthy (up to 120s)..."
    $max = 120; $elapsed = 0; $interval = 5
    while ($elapsed -lt $max) {
        $be = (docker inspect --format="{{.State.Health.Status}}" wgi_backend  2>$null)
        $pg = (docker inspect --format="{{.State.Health.Status}}" wgi_postgres 2>$null)
        if ($be -eq "healthy" -and $pg -eq "healthy") { Write-OK "All services healthy."; return }
        Write-Info "[${elapsed}s] postgres=$pg  backend=$be"
        Start-Sleep -Seconds $interval
        $elapsed += $interval
    }
    Write-Warn "Health check timed out. Run 'docker compose ps' to check status."
}

# ── Summary ───────────────────────────────────────────────────────────────────
function Show-Summary {
    Write-Header "Stack Status"
    Invoke-DockerCompose @("ps")

    Write-Header "Service Endpoints"
    Write-Host "  Developer Portal (Frontend):  http://localhost:3000" -ForegroundColor Green
    Write-Host "  Backend API:                  http://localhost:3001" -ForegroundColor Green
    Write-Host "  API Health Check:             http://localhost:3001/health" -ForegroundColor Green
    Write-Host "  Sandbox Base URL:             http://localhost:3001/v1/sandbox" -ForegroundColor Green
    Write-Host "  Prometheus Metrics:           http://localhost:9090" -ForegroundColor Green
    Write-Host "  Grafana Dashboards:           http://localhost:3003  (admin/admin)" -ForegroundColor Green
    if ($WithLogging) {
        Write-Host "  Kibana Logs UI:               http://localhost:5601" -ForegroundColor Green
        Write-Host "  Elasticsearch:                http://localhost:9200" -ForegroundColor Green
    }
    Write-Host ""
    Write-Host "  Next steps:"
    Write-Host "    1. Open http://localhost:3000 to access the developer portal"
    Write-Host "    2. Register an account, log in, and create an API key"
    Write-Host "    3. curl -H 'X-API-Key: <key>' http://localhost:3001/v1/sandbox/core-banking/accounts"
    Write-Host ""
    Write-Host "  To stop:         docker compose down"
    Write-Host "  Full reset:      docker compose down -v"
    Write-Host "============================================================" -ForegroundColor Cyan
}

# ── Main ──────────────────────────────────────────────────────────────────────
Write-Header "WekezaGlobal Developer Ecosystem — Windows Installer"
Write-Info "Repository root: $RepoRoot"

if (-not $SkipPrereqCheck) {
    Test-Prerequisites
    Test-DockerRunning
}

Initialize-Env
Get-Images
Build-Images
Start-Services
Wait-ForHealth
Show-Summary

$open = Read-Host "`nOpen http://localhost:3000 in your browser? [Y/n]"
if ($open -notmatch "^[Nn]") { Start-Process "http://localhost:3000" }
