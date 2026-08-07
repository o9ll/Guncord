/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    includeLog: {
        type: OptionType.BOOLEAN,
        description: "Include console.log (off by default — very noisy)",
        default: false
    },
    includeTrace: {
        type: OptionType.BOOLEAN,
        description: "Include console.trace (off by default)",
        default: false
    },
    maxEvents: {
        type: OptionType.NUMBER,
        description: "Maximum stored events (clamped between 50 and 5000)",
        default: 500
    }
});
