# ==============================================================================
#  Guncord — Post-Installation injection script
#  Used by the Inno Setup installer to inject Guncord into Discord.
# ==============================================================================

param(
    [string]$AppDir = $PSScriptRoot
)

$ErrorActionPreference = "Continue"

# 1. Locate Discord Stable
$DiscordPath = Join-Path $env:LOCALAPPDATA "Discord"
if (-not (Test-Path $DiscordPath)) {
    exit 0
}

# Find the latest version (app-*)
$LatestApp = Get-ChildItem $DiscordPath -Filter "app-*" | Sort-Object Name -Descending | Select-Object -First 1
if (-not $LatestApp) {
    exit 0
}

$CoreDir = Join-Path $LatestApp.FullName "resources"
$InjectDir = Join-Path $CoreDir "app"

# 2. Create the injection
if (-not (Test-Path $InjectDir)) {
    New-Item -ItemType Directory -Path $InjectDir -Force | Out-Null
}

# Generate the injection package.json
$PackageJson = @{
    name = "discord"
    main = "index.js"
} | ConvertTo-Json

Set-Content -Path (Join-Path $InjectDir "package.json") -Value $PackageJson

# Generate the injection index.js
# Point to patcher.js in the Guncord install folder
$GuncordPatcher = Join-Path $AppDir "dist\desktop\patcher.js"
$GuncordPatcher = $GuncordPatcher.Replace("\", "\\")

$IndexJs = @"
\"use strict\";
const path = require(\"path\");
const fs = require(\"fs\");

// Guncord injection
try {
    require(\"$GuncordPatcher\");
} catch (e) {
    console.error(\"Guncord injection failed:\", e);
    // Fallback to original Discord if possible
    const originalAsar = path.join(__dirname, \"..\", \"_app.asar\");
    if (fs.existsSync(originalAsar)) {
        require(originalAsar);
    }
}
"@

Set-Content -Path (Join-Path $InjectDir "index.js") -Value $IndexJs

exit 0

