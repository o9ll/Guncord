/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { PinIcon } from "@components/Icons";
import { EquicordDevs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "PinIcon",
    description: "Adds a pin icon to pinned messages",
    tags: ["Appearance", "Chat"],
    authors: [EquicordDevs.iamme],
    patches: [
        {
            find: "isUnsupported})",
            replacement: {
                match: /WITH_CONTENT\}\)/,
                replace: "$&,$self.renderPinIcon(arguments[0].message)"
            }
        }
    ],
    renderPinIcon: ErrorBoundary.wrap(message => {
        return message?.pinned ? (<PinIcon width={16} height={16} style={{ position: "absolute", right: "0", top: "0" }} />) : null;
    }, { noop: true })
});

