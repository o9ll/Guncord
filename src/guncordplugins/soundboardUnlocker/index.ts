/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
    name: "SoundboardUnlocker",
    description: "Allows using soundboard sounds from other guilds without Nitro.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    tags: ["Voice", "Fun"],
    enabledByDefault: false,
    patches: [
        {
            find: "canUseSoundboardEverywhere:function",
            replacement: {
                match: /(?<=canUseSoundboardEverywhere:function\(\i\)\{)/,
                replace: "return true;"
            }
        },
        {
            find: "SOUNDBOARD_SOUND_PICKER_UPSELL,upsellViewedTrackingData:",
            replacement: {
                match: /isNitroLocked:!\i(?=},key:\i\.id,items:\i)/,
                replace: "isNitroLocked:false"
            }
        }
    ]
});
