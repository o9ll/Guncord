/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

function settingsComponent() {
    return (
        <span style={{ color: "white" }}>
            <i>
                <b>
                    This fix isn't perfect, so you may have to reload the search bar to fix issues.
                </b>
            </i>
            Discord only allows a max offset of 5000 (this is what causes the magnifying glass error).
            This means that you can only see precisely 5000 messages into the past, and 5000 messages into the future (when sorting by old).
            This plugin just jumps to the opposite sorting method to try get around Discord's restriction,
            but if there is a large search result, and you try to view a message that is unobtainable with both methods of sorting,
            the plugin will simply show offset 0 (either newest or oldest message depending on the sorting method).
        </span>
    );
}

export default definePlugin({
    name: "SearchFix",
    description: 'Fixes the annoying "We dropped the magnifying glass!" error.',
    tags: ["Utility"],
    settingsAboutComponent: () => settingsComponent(),
    authors: [EquicordDevs.Jaxx],
    patches: [
        {
            find: '"SearchQueryStore";',
            replacement: {
                match: /\i\.searchResultsQuery=(\i)/,
                replace: "$&,$self.main($1)"
            }
        },
    ],
    main(query) {
        if (query.offset > 5000) {
            query.sort_order = query.sort_order === "asc" ? "desc" : "asc";

            if (query.offset > 5000 - 5000) {
                query.offset = 0;
            } else {
                query.offset -= 5000;
            }
        }
    }
});
