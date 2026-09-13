# ==============================================================================
#  Guncord — Universal Windows PowerShell Installer
#  Usage: irm https://raw.githubusercontent.com/o9ll/Guncord/main/install.ps1 | iex
# ==============================================================================

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"

$GitHubUrl    = "https://api.github.com"
$GitHubRepo   = "o9ll/Guncord"
$InstallDir   = Join-Path $env:LOCALAPPDATA "Guncord"
$DistDir      = Join-Path $InstallDir "dist"
$InstallerDir = Join-Path $InstallDir "installer"
$InstallerExe = Join-Path $InstallerDir "Guncord-Installer.exe"

function Write-Banner {
    Clear-Host
    Write-Host ""
    Write-Host "  =======================================================" -ForegroundColor Cyan
    Write-Host "             GUNCORD - WINDOWS INSTALLER               " -ForegroundColor White
    Write-Host "         Quick & Clean Discord Client Mod Setup          " -ForegroundColor DarkCyan
    Write-Host "  =======================================================" -ForegroundColor Cyan
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

Write-Banner

# Create folders
New-Item -ItemType Directory -Force -Path $InstallDir   | Out-Null
New-Item -ItemType Directory -Force -Path $InstallerDir | Out-Null
New-Item -ItemType Directory -Force -Path $DistDir      | Out-Null

# ── [1/3] Fetch the latest release from GitHub ────────────────────────────────
Write-Step 1 3 "Fetching latest release information..."

$apiUrl = "$GitHubUrl/repos/$GitHubRepo/releases/latest"
try {
    $release = Invoke-RestMethod -Uri $apiUrl -UseBasicParsing -Headers @{ "User-Agent" = "Guncord-Installer/2.0" }
    $version = $release.tag_name
    Write-OK "Latest version found: $version"
} catch {
    $version = "latest"
    Write-OK "Using version: $version"
}

# ── [2/3] Download Guncord-Installer or Guncord-Dist ──────────────────────────
Write-Step 2 3 "Downloading Guncord installer..."

$installerAsset = $release.assets | Where-Object { $_.name -eq "Guncord-Installer.exe" } | Select-Object -First 1
$distAsset      = $release.assets | Where-Object { $_.name -eq "guncord-dist.zip" } | Select-Object -First 1

if ($installerAsset) {
    try {
        Invoke-WebRequest -Uri $installerAsset.browser_download_url -OutFile $InstallerExe -UseBasicParsing `
            -Headers @{ "User-Agent" = "Guncord-Installer/2.0" }
        Write-OK "Guncord-Installer.exe downloaded successfully."
    } catch {
        Write-Fail "Failed to download Guncord-Installer.exe: $_"
    }
} elseif ($distAsset) {
    try {
        $zipPath = Join-Path $InstallDir "guncord-dist.zip"
        Invoke-WebRequest -Uri $distAsset.browser_download_url -OutFile $zipPath -UseBasicParsing `
            -Headers @{ "User-Agent" = "Guncord-Installer/2.0" }
        Expand-Archive -Path $zipPath -DestinationPath $DistDir -Force
        Remove-Item $zipPath -Force
        Write-OK "Guncord bundle extracted successfully."
    } catch {
        Write-Fail "Failed to download Guncord bundle: $_"
    }
} else {
    Write-Fail "No installation asset found for release $version."
}

# ── [3/3] Launching the installer ─────────────────────────────────────────────
Write-Step 3 3 "Launching installation..."

if (Test-Path $InstallerExe) {
    Start-Process -FilePath $InstallerExe
} else {
    # Direct injection if graphical exe is not available
    $discordPaths = @(
        "$env:LOCALAPPDATA\Discord",
        "$env:LOCALAPPDATA\DiscordCanary",
        "$env:LOCALAPPDATA\DiscordPTB",
        "$env:LOCALAPPDATA\DiscordDevelopment"
    )
    foreach ($disc in $discordPaths) {
        if (Test-Path $disc) {
            $appDirs = Get-ChildItem -Path $disc -Directory -Filter "app-*" | Sort-Object Name -Descending
            if ($appDirs.Count -gt 0) {
                $target = Join-Path $appDirs[0].FullName "resources\app"
                New-Item -ItemType Directory -Force -Path $target | Out-Null
                Copy-Item -Path "$DistDir\*" -Destination $target -Recurse -Force
                Set-Content -Path (Join-Path $target "package.json") -Value '{"name":"discord","main":"patcher.js"}'
                Write-OK "Injected into: $($appDirs[0].Name)"
            }
        }
    }
}

Write-Host ""
Write-Host "  =======================================================" -ForegroundColor Green
Write-Host "       Guncord installation completed successfully!      " -ForegroundColor Green
Write-Host "  =======================================================" -ForegroundColor Green
Write-Host ""
Start-Sleep -Seconds 3