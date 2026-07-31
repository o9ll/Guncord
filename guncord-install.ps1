# ==============================================================================
#  Guncord — User installer (standalone PowerShell)
#  
#  This script does EVERYTHING automatically:
#  1. Downloads EquilotlCli.exe (graphical injection tool)
#  2. Downloads the compiled Guncord files from GitHub
#  3. Opens the GUI to pick your target Discord
#  4. Injects Guncord into Discord
#
#  No Node.js, no pnpm, no source code required.
#  Usage: Right-click → "Run with PowerShell"
# ==============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

# ── Configuration ─────────────────────────────────────────────────────────────
$GuncordRepo   = "o9ll/Guncord"
$EquilotlUrl     = "https://github.com/Equicord/Equilotl/releases/latest/download/EquilotlCli.exe"
$InstallDir      = Join-Path $env:LOCALAPPDATA "Guncord"
$DistDir         = Join-Path $InstallDir "dist"
$InstallerDir    = Join-Path $InstallDir "installer"
$EquilotlExe     = Join-Path $InstallerDir "EquilotlCli.exe"

function Write-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  ╔══════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "  ║          GUNCORD  INSTALLER            ║" -ForegroundColor Cyan
    Write-Host "  ║  Fast injection into Discord Desktop     ║" -ForegroundColor DarkCyan
    Write-Host "  ╚══════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
}

function Write-Step($n, $total, $msg) {
    Write-Host "  [$n/$total] " -NoNewline -ForegroundColor Yellow
    Write-Host $msg
}

function Write-OK($msg) {
    Write-Host "          ✓ " -NoNewline -ForegroundColor Green
    Write-Host $msg
}

function Write-Fail($msg) {
    Write-Host ""
    Write-Host "  [ERROR] $msg" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Press any key to exit..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# ── Start ─────────────────────────────────────────────────────────────────────
Write-Banner

# Create the folders
New-Item -ItemType Directory -Force -Path $InstallDir  | Out-Null
New-Item -ItemType Directory -Force -Path $InstallerDir | Out-Null
New-Item -ItemType Directory -Force -Path $DistDir      | Out-Null

# ── [1/3] Download / update EquilotlCli.exe ──────────────────────────────────
Write-Step 1 3 "Checking the installer tool..."

$needDownload = $true
if (Test-Path $EquilotlExe) {
    # Check if an update is available via HEAD
    try {
        $head = Invoke-WebRequest -Uri $EquilotlUrl -Method Head -UseBasicParsing `
            -Headers @{ "User-Agent" = "Guncord-Installer/2.0" }
        $remoteSize = [long]($head.Headers["Content-Length"] ?? 0)
        $localSize  = (Get-Item $EquilotlExe).Length
        if ($remoteSize -gt 0 -and $remoteSize -eq $localSize) {
            $needDownload = $false
            Write-OK "EquilotlCli.exe already up to date."
        }
    } catch { }
}

if ($needDownload) {
    Write-Host "          Downloading EquilotlCli.exe..." -ForegroundColor DarkGray
    try {
        Invoke-WebRequest -Uri $EquilotlUrl -OutFile $EquilotlExe -UseBasicParsing `
            -Headers @{ "User-Agent" = "Guncord-Installer/2.0" }
        Write-OK "EquilotlCli.exe downloaded!"
    } catch {
        Write-Fail "Could not download EquilotlCli.exe.`n           Check your internet connection.`n           Detail: $_"
    }
}

# ── [2/3] Download the Guncord files ────────────────────────────────────────
Write-Step 2 3 "Downloading the Guncord files from GitHub..."

try {
    $apiUrl   = "https://api.github.com/repos/$GuncordRepo/releases/latest"
    $release  = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing `
        -Headers @{ "User-Agent" = "Guncord-Installer/2.0"; "Accept" = "application/vnd.github.v3+json" }

    $version  = $release.tag_name
    $distAsset = $release.assets | Where-Object { $_.name -eq "guncord-dist.zip" } | Select-Object -First 1

    if (-not $distAsset) {
        Write-Fail "File 'guncord-dist.zip' not found in release $version.`n           Contact Guncord support."
    }

    Write-Host "          Version: $version" -ForegroundColor DarkGray
    Write-Host "          Downloading..." -ForegroundColor DarkGray

    $zipPath = Join-Path $InstallDir "guncord-dist.zip"
    Invoke-WebRequest -Uri $distAsset.browser_download_url -OutFile $zipPath -UseBasicParsing `
        -Headers @{ "User-Agent" = "Guncord-Installer/2.0" }

    # Extract cleanly (remove the old dist first)
    if (Test-Path $DistDir) { Remove-Item $DistDir -Recurse -Force }
    New-Item -ItemType Directory -Force -Path $DistDir | Out-Null
    Expand-Archive -Path $zipPath -DestinationPath $DistDir -Force
    Remove-Item $zipPath -Force

    # Save the installed version
    Set-Content -Path (Join-Path $InstallDir "version.txt") -Value $version

    Write-OK "Guncord $version ready to inject!"
} catch {
    Write-Fail "Guncord download failed.`n           Detail: $_"
}

# ── [3/3] Inject via EquilotlCli ──────────────────────────────────────────────
Write-Step 3 3 "Launching the injection UI..."
Write-Host ""
Write-Host "          ┌─────────────────────────────────────────────────┐" -ForegroundColor DarkCyan
Write-Host "          │  A window will open.                            │" -ForegroundColor DarkCyan
Write-Host "          │  Pick the Discord to inject Guncord into.     │" -ForegroundColor DarkCyan
Write-Host "          └─────────────────────────────────────────────────┘" -ForegroundColor DarkCyan
Write-Host ""

# These env vars tell EquilotlCli where to find the files
$env:EQUICORD_USER_DATA_DIR = $InstallDir
$env:EQUICORD_DIRECTORY     = $DistDir
$env:EQUICORD_DEV_INSTALL   = "1"

try {
    & $EquilotlExe "--install"
    if ($LASTEXITCODE -ne 0) {
        Write-Fail "EquilotlCli returned an error (code $LASTEXITCODE)."
    }
} catch {
    Write-Fail "Could not launch the installer.`n           Detail: $_"
}

# ── Success ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "  ║  Guncord installed successfully!                   ║" -ForegroundColor Green
Write-Host "  ║                                                      ║" -ForegroundColor Green
Write-Host "  ║  → Restart Discord to apply Guncord.               ║" -ForegroundColor Green
Write-Host "  ╚══════════════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "  To uninstall: run guncord-uninstall.bat" -ForegroundColor DarkGray
Write-Host ""
Start-Sleep -Seconds 4

