#!/usr/bin/env bash
# ─── Guncord Installer — Build ─────────────────────────────────────────────
# bash equivalent of build-installer.ps1 (converted from build-installer.bat)

set -euo pipefail

cd "$(dirname "$0")"

echo ""
echo " ================================"
echo "  Guncord Installer - Build"
echo " ================================"
echo ""

# ── Check that node is available ──────────────────────────────────────────
if ! command -v node &>/dev/null; then
    echo " [ERROR] Node.js not found. Install Node.js from https://nodejs.org"
    exit 1
fi

# ── Create the output folder if needed ──────────────────────────────────────
mkdir -p "release/installer"

# ── Enter the installer folder ──────────────────────────────────────
cd installer

# ── 1. Install dependencies if node_modules is missing ───────────────────────
if [[ ! -d "node_modules" ]]; then
    echo " [1/3] Installing npm dependencies..."
    if ! npm install --legacy-peer-deps; then
        echo " [ERROR] npm install failed."
        cd ..
        exit 1
    fi
    echo " [1/3] Dependencies installed."
else
    echo " [1/3] Dependencies already present, skipping."
fi

# ── 2. Compile with electron-webpack ─────────────────────────────────────────
echo ""
echo " [2/3] Compiling webpack (electron-webpack)..."

if ! npm run compile; then
    echo " [ERROR] Webpack compilation failed."
    cd ..
    exit 1
fi

echo " [2/3] Webpack compilation succeeded."

# ── 3. Packaging electron-builder ────────────────────────────────────────────
echo ""
echo " [3/3] Packaging electron-builder..."

if ! npx electron-builder --win -p never; then
    echo " [ERROR] electron-builder failed."
    cd ..
    exit 1
fi

cd ..

# ── Verify ─────────────────────────────────────────────────────────────
if [[ ! -f "release/installer/Guncord-Installer.exe" ]]; then
    echo ""
    echo " [ERROR] Guncord-Installer.exe not found after build."
    exit 1
fi

SIZE=$(stat -c%s "release/installer/Guncord-Installer.exe" 2>/dev/null \
    || stat -f%z "release/installer/Guncord-Installer.exe")

echo ""
echo " [OK] Build succeeded!"
echo " File : release/installer/Guncord-Installer.exe  ($SIZE bytes)"
echo ""
