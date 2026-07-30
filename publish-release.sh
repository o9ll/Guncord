#!/usr/bin/env bash
# ─── Guncord — Publier une nouvelle release sur GitHub ─────────────────────
# Usage : ./publish-release.sh 1.18.1 "Description des changements"
# Necessite : pnpm, node, gh (GitHub CLI, authentifie)
#
# Auth : gh auth login  (ou configurer GITHUB_TOKEN)

set -euo pipefail

VERSION="${1:-}"
NOTES="${2:-}"

if [[ -z "$VERSION" ]]; then
    echo "[ERREUR] Usage: ./publish-release.sh VERSION \"Notes de version\""
    echo "Exemple : ./publish-release.sh 1.18.1 \"Correction bug audio\""
    exit 1
fi

[[ -z "$NOTES" ]] && NOTES="Guncord $VERSION"

# ── Config GitHub ──────────────────────────────────────────────────────────────
GITHUB_REPO="o9ll/Guncord"

# ── Verification gh CLI ──────────────────────────────────────────────────────
if ! command -v gh &>/dev/null; then
    echo "[ERREUR] gh CLI introuvable. Installez-le depuis https://cli.github.com/"
    exit 1
fi

if ! gh auth status &>/dev/null; then
    echo "[ERREUR] gh CLI non authentifie. Lancez : gh auth login"
    exit 1
fi

# ── Chemins de sortie ─────────────────────────────────────────────────────────
DIST_DIR="dist/desktop"
OUT_DIR="release/installer"
DIST_ZIP="$OUT_DIR/guncord-dist.zip"
INSTALLER_EXE="$OUT_DIR/Guncord-Installer.exe"
VERSION_JSON="$OUT_DIR/version.json"
DESKTOP_ASAR="dist/desktop.asar"

echo ""
echo " ╔═══════════════════════════════════════════════════╗"
echo " ║    GUNCORD — Publication release v$VERSION"
echo " ╚═══════════════════════════════════════════════════╝"
echo ""

# ── 1. Mise à jour des versions dans les fichiers ─────────────────────────────
echo " [1/8] Mise a jour de la version vers $VERSION..."

node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 4) + '\n', 'utf8');
"

echo " [1/8] Version mise a jour."

# ── 2. Envoi du code source sur GitHub ─────────────────────────────────────────
echo ""
echo " [2/8] Committer et pusher le code source..."

git add .

if ! git diff --quiet --cached; then
    git commit -m "build: release v$VERSION - $NOTES"
else
    echo " Aucun changement a committer."
fi

if ! git push --set-upstream origin main; then
    echo " [ERREUR] Impossible de push sur GitHub. Verifiez vos identifiants/droits d'acces."
    exit 1
fi

echo " [2/8] Code source synchronise avec GitHub."

# ── 3. Build JS (avec obfuscation automatique) ────────────────────────────────
echo ""
echo " [3/8] Build + obfuscation en cours..."

pkill -f "Discord" 2>/dev/null || true
sleep 2

if ! pnpm build; then
    echo " [ERREUR] pnpm build a echoue."
    exit 1
fi

echo " [3/8] Build + obfuscation termines !"

# ── 4. Preparer les assets supplementaires ────────────────────────────────────
echo ""
echo " [4/8] Copie des assets (ffmpeg, node, modules...) vers $DIST_DIR..."

node scripts/build/collect-assets.mjs

echo " [4/8] Assets copies."

# ── 5. Compiler Guncord-Installer.exe ──────────────────────────────────────
echo ""
echo " [5/8] Compilation de Guncord-Installer.exe..."

mkdir -p "$OUT_DIR"

if command -v pwsh >/dev/null 2>&1; then
    pwsh -NoProfile -ExecutionPolicy Bypass -File "build-installer.ps1"
elif command -v powershell >/dev/null 2>&1; then
    powershell -NoProfile -ExecutionPolicy Bypass -File "build-installer.ps1"
elif [[ -x "./build-installer.sh" ]]; then
    ./build-installer.sh
else
    echo " [ERREUR] Aucun build-installer compatible trouve (pwsh, powershell ou build-installer.sh)."
    exit 1
fi

if [[ ! -f "$INSTALLER_EXE" ]]; then
    echo " [ERREUR] Guncord-Installer.exe introuvable apres compilation."
    exit 1
fi

INSTALLER_SIZE=$(stat -c%s "$INSTALLER_EXE" 2>/dev/null || stat -f%z "$INSTALLER_EXE")
echo " [5/8] Guncord-Installer.exe cree ($INSTALLER_SIZE octets)"

# ── 6. Créer guncord-dist.zip ──────────────────────────────────────────────
echo ""
echo " [6/8] Creation de guncord-dist.zip..."

if [[ ! -f "$DIST_DIR/patcher.js" ]]; then
    echo " [ERREUR] dist/desktop/patcher.js introuvable."
    exit 1
fi

[[ -f "$DIST_ZIP" ]] && rm -f "$DIST_ZIP"

find "$DIST_DIR" -name "*.map"       -delete
find "$DIST_DIR" -name "*.LEGAL.txt" -delete

if ! node scripts/build/verify-dist.mjs; then
    echo " [ERREUR] Verification du dist echouee - @babel manquant ou incomplet."
    exit 1
fi

(cd "$DIST_DIR" && zip -r -9 "../../$DIST_ZIP" .)

if [[ ! -f "$DIST_ZIP" ]]; then
    echo " [ERREUR] Impossible de creer guncord-dist.zip"
    exit 1
fi

DIST_ZIP_SIZE=$(stat -c%s "$DIST_ZIP" 2>/dev/null || stat -f%z "$DIST_ZIP")
echo " [6/8] guncord-dist.zip cree ($DIST_ZIP_SIZE octets)"

# ── 7. Mettre à jour version.json ─────────────────────────────────────────────
echo ""
echo " [7/8] Mise a jour de version.json..."

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

echo " [7/8] version.json mis a jour."

TAG_NAME="v$VERSION"

if git rev-parse "$TAG_NAME" >/dev/null 2>&1; then
    echo " Tag local $TAG_NAME deja present."
else
    git tag "$TAG_NAME"
fi

git push origin "$TAG_NAME"

# ── 8. Publier sur GitHub Releases ─────────────────────────────────────────────
echo ""
echo " [8/8] Creation de la release v$VERSION sur GitHub..."

gh release create "$TAG_NAME" \
    --title "Guncord v$VERSION" \
    --notes "$NOTES" \
    "$INSTALLER_EXE" \
    "$DIST_ZIP" \
    "$DESKTOP_ASAR" \
    "$VERSION_JSON"

if [[ $? -ne 0 ]]; then
    echo " [ERREUR] Echec de la creation de la release GitHub."
    exit 1
fi

# ── Done ───────────────────────────────────────────────────────────────────────
echo ""
echo " ╔═══════════════════════════════════════════════════════════════════════╗"
echo " ║  Guncord v$VERSION publie avec succes sur GitHub !"
echo " ║"
echo " ║  URL : https://github.com/$GITHUB_REPO/releases/tag/$TAG_NAME"
echo " ║"
echo " ║  Fichiers publies :"
echo " ║    Guncord-Installer.exe    — installeur .exe avec GUI"
echo " ║    guncord-dist.zip         — JS obfusques (pour l'injec.)"
echo " ║    desktop.asar               — asar Discord patcher"
echo " ║    version.json               — metadonnees de version"
echo " ╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

