/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// HeaderBarAPI patches are in src/plugins/_api/headerBar.ts
// This file exists solely to satisfy equicordplugins/_api build system

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "HeaderBarAPIEquicord",
    description: "Equicord extension stub for HeaderBarAPI",
    authors: [Devs.prism],
    hidden: true,
    patches: []
});

