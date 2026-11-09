/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as metro from "./metro";
import * as patcher from "./patcher";
import * as plugins from "./plugins";
import * as storage from "./storage";
import * as ui from "./ui";

const GuncordMobile = {
    version: "1.31.7",
    metro,
    patcher,
    plugins,
    storage,
    ui
};

export default GuncordMobile;

function initialize() {
    console.log("[Guncord Mobile] Initializing Hermes React Native runtime...");

    try {
        metro.initializeMetro();
        storage.initStorage();
        plugins.startAllEnabled();
        ui.patchSettings();

        const g = globalThis as any;
        g.guncord = GuncordMobile;
        g.Guncord = GuncordMobile;

        console.log("[Guncord Mobile] Successfully initialized.");
    } catch (err) {
        console.error("[Guncord Mobile] Initialization failed:", err);
    }
}

// Auto-run on load
initialize();

