/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { OptionType } from "@utils/types";

export const settings = definePluginSettings({
    exportFormat: {
        type: OptionType.SELECT,
        description: "File format used when exporting the member list.",
        options: [
            { label: "JSON", value: "json", default: true },
            { label: "CSV", value: "csv" }
        ]
    }
});
