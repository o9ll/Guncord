/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { BrowserWindowConstructorOptions } from "electron";

export const SplashProps: BrowserWindowConstructorOptions = {
    transparent: true,
    frame: false,
    height: 350,
    width: 300,
    center: true,
    resizable: false,
    maximizable: false,
    alwaysOnTop: true
};
