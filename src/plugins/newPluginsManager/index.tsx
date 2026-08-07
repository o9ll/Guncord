/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

import * as KnownSettings from "./knownSettings";
import { KNOWN_PLUGINS_LEGACY_DATA_KEY, KNOWN_SETTINGS_DATA_KEY } from "./knownSettings";
import { openNewPluginsModal } from "./NewPluginsModal";

export default definePlugin({
    name: "NewPluginsManager",
    description: "Utility that notifies you when new plugins are added to Equicord",
    tags: ["Utility"],
    authors: [Devs.Sqaaakoi],
    enabledByDefault: true,
    flux: {
        async POST_CONNECTION_OPEN() {
            openNewPluginsModal();
        }
    },
    openNewPluginsModal,
    KNOWN_PLUGINS_LEGACY_DATA_KEY,
    KNOWN_SETTINGS_DATA_KEY,
    KnownSettings
});
