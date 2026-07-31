#!/usr/bin/env bash
# ─── Guncord — Publish a new release to GitHub ─────────────────────────────
# Usage: ./publish-release.sh 1.18.1 "Change description"
# Requires: pnpm, node, gh (GitHub CLI, authenticated)
#
# Auth: gh auth login  (or set GITHUB_TOKEN)

set -euo pipefail

VERSION="${1:-}"
NOTES="${2:-}"

if [[ -z "$VERSION" ]]; then
    echo "[ERROR] Usage: ./publish-release.sh VERSION \"Release notes\""
    echo "Example: ./publish-release.sh 1.18.1 \"Audio bug fix\""
    exit 1
fi

[[ -z "$NOTES" ]] && NOTES="Guncord $VERSION"

# ── GitHub config ──────────────────────────────────────────────────────────────
GITHUB_REPO="o9ll/Guncord"

# ── Check gh CLI ─────────────────────────────────────────────────────────────
if ! command -v gh &>/dev/null; then
    echo "[ERROR] gh CLI not found. Install it from https://cli.github.com/"
    exit 1
fi

if ! gh auth status &>/dev/null; then
    echo "[ERROR] gh CLI not authenticated. Run: gh auth login"
    exit 1
fi

# ── Output paths ──────────────────────────────────────────────────────────────
DIST_DIR="dist/desktop"
OUT_DIR="release/installer"
DIST_ZIP="$OUT_DIR/guncord-dist.zip"
INSTALLER_EXE="$OUT_DIR/Guncord-Installer.exe"
VERSION_JSON="$OUT_DIR/version.json"
DESKTOP_ASAR="dist/desktop.asar"

echo ""
echo " ╔═══════════════════════════════════════════════════╗"
echo " ║    GUNCORD — Publishing release v$VERSION"
echo " ╚═══════════════════════════════════════════════════╝"
echo ""

# ── 1. Update versions in files ───────────────────────────────────────────────
echo " [1/8] Updating version to $VERSION..."

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 4) + '\n', 'utf8');
"

echo " [1/8] Version updated."

# ── 2. Push source code to GitHub ──────────────────────────────────────────────
echo ""
echo " [2/8] Committing and pushing source code..."

git add .

if ! git diff --quiet --cached; then
    git commit -m "build: release v$VERSION - $NOTES"
else
    echo " No changes to commit."
fi

if ! git push --set-upstream origin main; then
    echo " [ERROR] Could not push to GitHub. Check your credentials/access rights."
    exit 1
fi

echo " [2/8] Source code synced with GitHub."

# ── 3. Build JS (with automatic obfuscation) ──────────────────────────────────
echo ""
echo " [3/8] Building + obfuscating..."

pkill -f "Discord" 2>/dev/null || true
sleep 2

if ! pnpm build; then
    echo " [ERROR] pnpm build failed."
    exit 1
fi

echo " [3/8] Build + obfuscation done!"

# ── 4. Prepare additional assets ──────────────────────────────────────────────
echo ""
echo " [4/8] Copying assets (ffmpeg, node, modules...) to $DIST_DIR..."

node scripts/build/collect-assets.mjs

echo " [4/8] Assets copied."

# ── 5. Compile Guncord-Installer.exe ───────────────────────────────────────
echo ""
echo " [5/8] Compiling Guncord-Installer.exe..."

mkdir -p "$OUT_DIR"

if command -v pwsh >/dev/null 2>&1; then
    pwsh -NoProfile -ExecutionPolicy Bypass -File "build-installer.ps1"
elif command -v powershell >/dev/null 2>&1; then
    powershell -NoProfile -ExecutionPolicy Bypass -File "build-installer.ps1"
elif [[ -x "./build-installer.sh" ]]; then
    ./build-installer.sh
else
    echo " [ERROR] No compatible build-installer found (pwsh, powershell or build-installer.sh)."
    exit 1
fi

if [[ ! -f "$INSTALLER_EXE" ]]; then
    echo " [ERROR] Guncord-Installer.exe not found after compilation."
    exit 1
fi

INSTALLER_SIZE=$(stat -c%s "$INSTALLER_EXE" 2>/dev/null || stat -f%z "$INSTALLER_EXE")
echo " [5/8] Guncord-Installer.exe created ($INSTALLER_SIZE bytes)"

# ── 6. Create guncord-dist.zip ─────────────────────────────────────────────
echo ""
echo " [6/8] Creating guncord-dist.zip..."

if [[ ! -f "$DIST_DIR/patcher.js" ]]; then
    echo " [ERROR] dist/desktop/patcher.js not found."
    exit 1
fi

[[ -f "$DIST_ZIP" ]] && rm -f "$DIST_ZIP"

find "$DIST_DIR" -name "*.map"       -delete
find "$DIST_DIR" -name "*.LEGAL.txt" -delete

if ! node scripts/build/verify-dist.mjs; then
    echo " [ERROR] Dist verification failed - @babel missing or incomplete."
    exit 1
fi

(cd "$DIST_DIR" && zip -r -9 "../../$DIST_ZIP" .)

if [[ ! -f "$DIST_ZIP" ]]; then
    echo " [ERROR] Could not create guncord-dist.zip"
    exit 1
fi

DIST_ZIP_SIZE=$(stat -c%s "$DIST_ZIP" 2>/dev/null || stat -f%z "$DIST_ZIP")
echo " [6/8] guncord-dist.zip created ($DIST_ZIP_SIZE bytes)"

# ── 7. Update version.json ────────────────────────────────────────────────────
echo ""
echo " [7/8] Updating version.json..."

ISO_DATE=$(date +%Y-%m-%d)

cat > "$VERSION_JSON" <<EOF
{
  "version": "$VERSION",
  "releaseDate": "$ISO_DATE",
  "installerUrl": "https://github.com/$GITHUB_REPO/releases/download/v$VERSION/Guncord-Installer.exe",
  "distUrl": "https://github.com/$GITHUB_REPO/releases/download/v$VERSION/guncord-dist.zip",
  "downloadUrl": "https://github.com/$GITHUB_REPO/releases/download/v$VERSION/desktop.asar",
  "changelog": "$NOTES"
}
EOF

echo " [7/8] version.json updated."

TAG_NAME="v$VERSION"

if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    echo " Local tag $TAG_NAME already present."
else
    git tag "$TAG_NAME"
fi

git push origin "$TAG_NAME"

# ── 8. Publish to GitHub Releases ──────────────────────────────────────────────
echo ""
echo " [8/8] Creating release v$VERSION on GitHub..."

gh release create "$TAG_NAME" \
    --title "Guncord v$VERSION" \
    --notes "$NOTES" \
    "$INSTALLER_EXE" \
    "$DIST_ZIP" \
    "$DESKTOP_ASAR" \
    "$VERSION_JSON"

if [[ $? -ne 0 ]]; then
    echo " [ERROR] Failed to create the GitHub release."
    exit 1
fi

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo " ╔═══════════════════════════════════════════════════════════════════════╗"
echo " ║  Guncord v$VERSION published successfully on GitHub!"
echo " ║"
echo " ║  URL: https://github.com/$GITHUB_REPO/releases/tag/$TAG_NAME"
echo " ║"
echo " ║  Published files:"
echo " ║    Guncord-Installer.exe    — GUI .exe installer"
echo " ║    guncord-dist.zip         — Obfuscated JS (for injection)"
echo " ║    desktop.asar               — Discord patcher asar"
echo " ║    version.json               — Version metadata"
echo " ╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

