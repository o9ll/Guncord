/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface LbTrackData {
    name: string;
    album: string;
    artist: string;
    durationMs?: number;
    recordingMBID?: string;
    url: string;
    imageUrl?: string;
}
