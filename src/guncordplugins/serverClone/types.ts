/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface CloneOptions {
    cloneChannels: boolean;
    cloneRoles: boolean;
    cloneOnboarding: boolean;
    cloneSystemFlags: boolean;
    resumeMode: boolean;
    targetGuildId: string | null;
    cloneStickers: boolean;
    cloneSoundboard: boolean;
}
