/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { migratePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

migratePluginSettings("IloveSpam", "iLoveSpam");
export default definePlugin({
    name: "ILoveSpam",
    description: "Do not hide messages from 'likely spammers'",
    tags: ["Utility", "Chat"],
    authors: [Devs.botato, Devs.Nyako],
    patches: [
        {
            find: "hasFlag:{writable",
            replacement: {
                match: /if\((\i)<=(?:0x40000000|(?:1<<30|1073741824))\)return/,
                replace: "if($1===(1<<20))return false;$&",
            },
        },
    ],
});
