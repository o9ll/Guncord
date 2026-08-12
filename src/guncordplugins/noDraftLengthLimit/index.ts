/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
    name: "NoDraftLengthLimit",
    description: "Removes the 4500 character saved draft message truncation",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    tags: ["Chat", "Utility"],
    enabledByDefault: false,
    patches: [
        {
            find: "MAX_MESSAGE_LENGTH_PREMIUM+500",
            replacement: {
                match: /=[^=]{0,20}MAX_MESSAGE_LENGTH_PREMIUM\+500/,
                replace: "=Infinity"
            }
        }
    ]
});