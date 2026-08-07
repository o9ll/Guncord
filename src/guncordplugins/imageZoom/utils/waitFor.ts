/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export function waitFor(condition: () => boolean, cb: () => void) {
    if (condition()) cb();
    else requestAnimationFrame(() => waitFor(condition, cb));
}
