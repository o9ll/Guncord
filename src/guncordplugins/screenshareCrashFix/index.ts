/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
    name: "ScreenshareCrashFix",
    description: "Fixes the unknown resolution/frame rate crash when watching someone's stream",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    tags: ["Voice", "Utility"],
    enabledByDefault: false,
    patches: [
        {
            find: 'Error("Unknown resolution: ".concat',
            replacement: {
                match: /switch\((\i)\).{0,150}?Error/g,
                replace: "return $1;$&"
            }
        }
    ]

});