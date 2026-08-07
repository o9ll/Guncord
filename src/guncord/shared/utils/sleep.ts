/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
}
