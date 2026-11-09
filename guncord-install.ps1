# ==============================================================================
#  Guncord — User installer (standalone PowerShell script)
#  Usage: Right-click → "Run with PowerShell"
# ==============================================================================

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$installPs1 = Join-Path $scriptDir "install.ps1"

if (Test-Path $installPs1) {
    & $installPs1
} else {
    irm https://raw.githubusercontent.com/o9ll/Guncord/main/install.ps1 | iex
}

