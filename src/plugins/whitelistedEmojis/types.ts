/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface ContextMenuEmoji {
    type: string;
    id: string;
    name: string;
    surrogates?: string;
}

export interface Target {
    dataset: ContextMenuEmoji;
}

export interface SavedEmoji {
    type: string;
    id: string;
    name: string;
    guildId?: string;
    surrogates?: string;
    url?: string;
    animated?: boolean;
}
