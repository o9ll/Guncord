/*
 * Guncord, a modification for Discord's desktop app
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { join } from "path";
import { isAlreadyPatched, patchResourcesDir } from "./applyHostPatch";

/**
 * Legacy compatibility entrypoint.
 * Safely delegates to the atomic applyHostPatch logic.
 */
function patchCurrentDiscordOnly() {
    try {
        const currentResources = process.resourcesPath;
        if (currentResources && !isAlreadyPatched(currentResources)) {
            patchResourcesDir(currentResources, join(__dirname, "patcher.js"));
        }
    } catch (e) {
        console.error("[Guncord] patchCurrentDiscordOnly error:", e);
    }
}

patchCurrentDiscordOnly();

