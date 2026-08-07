/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "SelfForward",
    description: "Adds the current channel to the forward list popup",
    tags: ["Utility"],
    authors: [EquicordDevs.VillainsRule],
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
