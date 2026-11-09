/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { UserStore } from "@webpack/common";

export default definePlugin({
    name: "NoProfileThemes",
    description: "Completely removes Nitro profile themes from everyone but yourself",
    tags: ["Appearance"],
    authors: [Devs.TheKodeToad],
    patches: [
        {
            find: "canEditThemes(){",
            replacement: {
                // FakeProfileThemes patches the same function to always return true. If both are enabled, the final code will be
                // `return $self.isCurrentUser(this?.userId) && true`, which still works
                // This relies on the fact that FakeProfileThemes is applied first due to alphabetical order
                match: /get canEditThemes\(\){return /,
                replace: "$&$self.isCurrentUser(this?.userId)&&"
            }
        },
    ],

    isCurrentUser: (userId: string) => userId === UserStore.getCurrentUser()?.id,
});

