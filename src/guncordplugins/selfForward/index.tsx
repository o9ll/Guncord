/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
    name: "SelfForward",
    description: "shows the current channel in the message forward popup",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    tags: ["Chat", "Utility"],
    enabledByDefault: false,
    patches: [
        {
            find: ".getChannelHistory(),",
            replacement: [{
                match: /\i.id\]/,
                replace: "]"
            }]
        }
    ]
});