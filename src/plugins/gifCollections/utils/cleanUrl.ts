/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function cleanUrl(url: string): string {
    try {
        const urlObject = new URL(url);
        urlObject.search = "";
        return urlObject.href;
    } catch {
        return url;
    }
}
