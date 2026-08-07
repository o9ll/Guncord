/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function copyToClipboard(text: string): Promise<void> {
    return IS_DISCORD_DESKTOP ? DiscordNative.clipboard.copy(text) : navigator.clipboard.writeText(text);
}

export function readClipboard(): Promise<string> {
    return IS_DISCORD_DESKTOP ? DiscordNative.clipboard.read() : navigator.clipboard.readText();
}
