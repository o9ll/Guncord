/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Notice } from "@components/Notice";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "NeverPausePreviews",
    description: "Prevents in-call/PiP previews (screenshare, streams, etc) from pausing even if the client loses focus",
    tags: ["Media"],
    authors: [EquicordDevs.vappstar],
    settingsAboutComponent: () => (
        <Notice.Warning>
            This plugin will cause discord to use more resources than normal
        </Notice.Warning>
    ),
    patches: [
        {
            find: "streamerPaused()",
            replacement: {
                match: /streamerPaused\(\)\{/,
                replace: "$&return false;"
            }
        },
        {
            find: "StreamTile",
            replacement: {
                match: /\i\.\i\.isFocused\(\)/,
                replace: "true"
            }
        }
    ],
});

