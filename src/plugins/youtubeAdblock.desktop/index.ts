/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

// The entire code of this plugin can be found in native.ts
export default definePlugin({
    name: "YoutubeAdblock",
    enabledByDefault: true,
    description: "Block ads in YouTube embeds and the WatchTogether activity via AdGuard",
    tags: ["Media", "Utility"],
    authors: [Devs.ImLvna, Devs.Ven],
});
