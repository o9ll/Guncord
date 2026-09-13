# install.sh
#!/usr/bin/env bash
#
# Guncord Universal Interactive Installer for Linux & macOS
# Copyright (c) 2026 o9
# SPDX-License-Identifier: GPL-3.0-or-later
#

set -e

# ANSI Colors & Formatting
BOLD="\033[1m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
WHITE="\033[97m"
DIM="\033[2m"
RESET="\033[0m"

log_info() {
    echo -e "${CYAN}[Guncord]${RESET} $1"
}

log_success() {
    echo -e "${GREEN}[Guncord]${RESET} $1"
}

log_warn() {
    echo -e "${YELLOW}[Guncord]${RESET} $1"
}

log_error() {
    echo -e "${RED}[Guncord]${RESET} $1"
}

echo -e "\n${BOLD}======================================================${RESET}"
echo -e "${BOLD}${WHITE}           GUNCORD UNIVERSAL INSTALLER             ${RESET}"
echo -e "${DIM}      Linux (All Distros & NixOS) + macOS (All Macs) ${RESET}"
echo -e "${BOLD}======================================================${RESET}\n"

OS="$(uname -s)"
ARCH="$(uname -m)"

log_info "Operating System: ${WHITE}$OS ($ARCH)${RESET}"

DOWNLOAD_URL="https://github.com/o9ll/Guncord/releases/download/latest"
FALLBACK_URL="https://raw.githubusercontent.com/o9ll/Guncord/main/dist"

TMP_DIR="$(mktemp -d /tmp/guncord-install-XXXXXX)"
cleanup() {
    rm -rf "$TMP_DIR"
}
trap cleanup EXIT

download_guncord_bundle() {
    log_info "Downloading latest Guncord bundle..."
    mkdir -p "$TMP_DIR/extracted"
    
    # 1. Try downloading guncord-dist.zip
    if curl -sSL "$DOWNLOAD_URL/guncord-dist.zip" -o "$TMP_DIR/guncord-dist.zip" 2>/dev/null && [ -s "$TMP_DIR/guncord-dist.zip" ]; then
        unzip -q -o "$TMP_DIR/guncord-dist.zip" -d "$TMP_DIR/extracted"
        log_success "Downloaded & extracted Guncord bundle."
    elif curl -sSL "$DOWNLOAD_URL/guncordDesktop.asar" -o "$TMP_DIR/guncordDesktop.asar" 2>/dev/null && [ -s "$TMP_DIR/guncordDesktop.asar" ]; then
        cp "$TMP_DIR/guncordDesktop.asar" "$TMP_DIR/extracted/guncordDesktop.asar"
        log_success "Downloaded Guncord ASAR bundle."
    else
        log_warn "Downloading from repository branch fallback..."
        mkdir -p "$TMP_DIR/extracted"
        curl -sSL "$FALLBACK_URL/desktop/patcher.js" -o "$TMP_DIR/extracted/patcher.js"
        curl -sSL "$FALLBACK_URL/desktop/preload.js" -o "$TMP_DIR/extracted/preload.js"
        curl -sSL "$FALLBACK_URL/desktop/renderer.js" -o "$TMP_DIR/extracted/renderer.js"
        curl -sSL "$FALLBACK_URL/desktop/renderer.css" -o "$TMP_DIR/extracted/renderer.css"
        log_success "Downloaded Guncord scripts."
    fi
}

inject_into_app_dir() {
    local target_app_dir="$1"
    local app_name="$2"

    mkdir -p "$target_app_dir"

    # Copy files
    if [ -f "$TMP_DIR/extracted/guncordDesktop.asar" ]; then
        cp "$TMP_DIR/extracted/guncordDesktop.asar" "$target_app_dir/guncordDesktop.asar"
        cat << 'EOF' > "$target_app_dir/index.js"
/* Guncord Loader */
require("./guncordDesktop.asar");
EOF
    elif [ -f "$TMP_DIR/extracted/patcher.js" ]; then
        cp -r "$TMP_DIR/extracted/"* "$target_app_dir/"
        cat << 'EOF' > "$target_app_dir/index.js"
/* Guncord Loader */
require("./patcher.js");
EOF
    fi

    # Create package.json
    cat << 'EOF' > "$target_app_dir/package.json"
{
  "name": "discord",
  "main": "index.js"
}
EOF

    log_success "Injected Guncord into ${WHITE}$app_name${RESET} -> $target_app_dir"
}

# ─── macOS Installation ────────────────────────────────────────────────────────
install_macos() {
    log_info "Scanning for Discord installations on macOS..."

    CANDIDATES=(
        "Discord (Stable):/Applications/Discord.app/Contents/Resources"
        "Discord Canary:/Applications/Discord Canary.app/Contents/Resources"
        "Discord PTB:/Applications/Discord PTB.app/Contents/Resources"
        "Discord Development:/Applications/Discord Development.app/Contents/Resources"
        "User Discord:$HOME/Applications/Discord.app/Contents/Resources"
        "User Discord Canary:$HOME/Applications/Discord Canary.app/Contents/Resources"
    )

    FOUND_NAMES=()
    FOUND_PATHS=()

    for item in "${CANDIDATES[@]}"; do
        IFS=":" read -r name path <<< "$item"
        if [ -d "$path" ]; then
            FOUND_NAMES+=("$name")
            FOUND_PATHS+=("$path")
        fi
    done

    if [ ${#FOUND_PATHS[@]} -eq 0 ]; then
        log_error "No Discord installation found on your Mac."
        log_info "Please install Discord first from https://discord.com"
        exit 1
    fi

    download_guncord_bundle

    echo -e "\n${BOLD}Select which Discord to patch:${RESET}"
    for i in "${!FOUND_NAMES[@]}"; do
        echo -e "  ${CYAN}[$((i+1))]${RESET} ${WHITE}${FOUND_NAMES[$i]}${RESET} ${DIM}(${FOUND_PATHS[$i]})${RESET}"
    done
    if [ ${#FOUND_PATHS[@]} -gt 1 ]; then
        echo -e "  ${CYAN}[$(( ${#FOUND_PATHS[@]} + 1 ))]${RESET} ${GREEN}All installations (All Discords)${RESET}"
    fi

    echo ""
    read -r -p "Your choice [1-$(( ${#FOUND_PATHS[@]} > 1 ? ${#FOUND_PATHS[@]} + 1 : 1 ))] (Default: 1): " CHOICE < /dev/tty || CHOICE="1"
    CHOICE="${CHOICE:-1}"

    if [ "$CHOICE" -eq "$(( ${#FOUND_PATHS[@]} + 1 ))" ]; then
        for i in "${!FOUND_PATHS[@]}"; do
            inject_into_app_dir "${FOUND_PATHS[$i]}/app" "${FOUND_NAMES[$i]}"
        done
    else
        IDX=$((CHOICE - 1))
        if [ $IDX -ge 0 ] && [ $IDX -lt ${#FOUND_PATHS[@]} ]; then
            inject_into_app_dir "${FOUND_PATHS[$IDX]}/app" "${FOUND_NAMES[$IDX]}"
        else
            log_error "Invalid selection."
            exit 1
        fi
    fi

    echo -e "\n${GREEN}${BOLD}------------------------------------------------------${RESET}"
    echo -e "${GREEN}${BOLD}  Guncord successfully installed on macOS!          ${RESET}"
    echo -e "${WHITE}  Restart Discord to activate Guncord.              ${RESET}"
    echo -e "${GREEN}${BOLD}------------------------------------------------------${RESET}\n"
}

# ─── Linux Installation ────────────────────────────────────────────────────────
install_linux() {
    log_info "Scanning for Discord installations on Linux..."

    CANDIDATES=(
        "Discord (System Native):/usr/share/discord/resources"
        "Discord (/usr/lib):/usr/lib/discord/resources"
        "Discord (/opt):/opt/discord/resources"
        "Discord Canary (System):/usr/share/discord-canary/resources"
        "Discord Canary (/opt):/opt/discord-canary/resources"
        "Discord PTB (System):/usr/share/discord-ptb/resources"
        "Discord PTB (/opt):/opt/discord-ptb/resources"
        "Discord (Local User):$HOME/.local/share/discord/resources"
        "Discord Canary (Local):$HOME/.local/share/discord-canary/resources"
        "Discord (Flatpak):$HOME/.var/app/com.discordapp.Discord/data/discord/resources"
        "Discord Canary (Flatpak):$HOME/.var/app/com.discordapp.DiscordCanary/data/discord/resources"
        "Discord (Snap):$HOME/snap/discord/current/resources"
        "User Config Profile (~/.config/discord):$HOME/.config/discord"
    )

    FOUND_NAMES=()
    FOUND_PATHS=()

    for item in "${CANDIDATES[@]}"; do
        IFS=":" read -r name path <<< "$item"
        if [ -d "$path" ]; then
            FOUND_NAMES+=("$name")
            FOUND_PATHS+=("$path")
        fi
    done

    # If none found in standard paths, offer ~/.config/discord
    if [ ${#FOUND_PATHS[@]} -eq 0 ]; then
        FOUND_NAMES+=("User Config Discord (~/.config/discord)")
        FOUND_PATHS+=("$HOME/.config/discord")
    fi

    download_guncord_bundle

    echo -e "\n${BOLD}Select which Discord installation to patch:${RESET}"
    for i in "${!FOUND_NAMES[@]}"; do
        echo -e "  ${CYAN}[$((i+1))]${RESET} ${WHITE}${FOUND_NAMES[$i]}${RESET} ${DIM}(${FOUND_PATHS[$i]})${RESET}"
    done
    if [ ${#FOUND_PATHS[@]} -gt 1 ]; then
        echo -e "  ${CYAN}[$(( ${#FOUND_PATHS[@]} + 1 ))]${RESET} ${GREEN}All detected installations (All Discords)${RESET}"
    fi

    echo ""
    read -r -p "Your choice [1-$(( ${#FOUND_PATHS[@]} > 1 ? ${#FOUND_PATHS[@]} + 1 : 1 ))] (Default: 1): " CHOICE < /dev/tty || CHOICE="1"
    CHOICE="${CHOICE:-1}"

    if [ "$CHOICE" -eq "$(( ${#FOUND_PATHS[@]} + 1 ))" ]; then
        for i in "${!FOUND_PATHS[@]}"; do
            inject_into_app_dir "${FOUND_PATHS[$i]}/app" "${FOUND_NAMES[$i]}"
        done
    else
        IDX=$((CHOICE - 1))
        if [ $IDX -ge 0 ] && [ $IDX -lt ${#FOUND_PATHS[@]} ]; then
            inject_into_app_dir "${FOUND_PATHS[$IDX]}/app" "${FOUND_NAMES[$IDX]}"
        else
            log_error "Invalid selection."
            exit 1
        fi
    fi

    echo -e "\n${GREEN}${BOLD}------------------------------------------------------${RESET}"
    echo -e "${GREEN}${BOLD}  Guncord successfully installed on Linux!          ${RESET}"
    echo -e "${WHITE}  Restart Discord to activate Guncord.              ${RESET}"
    echo -e "${GREEN}${BOLD}------------------------------------------------------${RESET}\n"
}

case "$OS" in
    Darwin)
        install_macos
        ;;
    Linux)
        install_linux
        ;;
    *)
        log_error "Unsupported operating system: $OS"
        log_info "For Windows, please use the official Guncord-Installer.exe"
        exit 1
        ;;
esac