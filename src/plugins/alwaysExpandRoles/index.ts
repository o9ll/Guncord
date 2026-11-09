/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, migratePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    hideArrow: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Hide Arrow",
        restartNeeded: true
    },
});

migratePluginSettings("AlwaysExpandRoles", "ShowAllRoles");
export default definePlugin({
    name: "AlwaysExpandRoles",
    description: "Always expands the role list in profile popouts",
    tags: ["Appearance", "Roles"],
    authors: [Devs.surgedevs],
    isModified: true,
    settings,
    patches: [
        {
            find: "hasDeveloperContextMenu:",
            replacement: [
                {
                    match: /(?<=\?\i\.current\[\i\].{0,100}?)useState\(!1\)/,
                    replace: "useState(!0)"
                },
                {
                    // Fix not calculating non-expanded roles because the above patch makes the default "expanded",
                    // which makes the collapse button never show up and calculation never occur
                    match: /(?<=useLayoutEffect\(\(\)=>\{if\()\i/,
                    replace: "false"
                },
                {
                    match: /return \i\.length<\i\.length/,
                    replace: "return false",
                    predicate: () => settings.store.hideArrow
                }
            ]
        }
    ],
});
