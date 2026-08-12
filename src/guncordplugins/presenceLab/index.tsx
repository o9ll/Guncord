/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ComponentsIcon } from "@components/Icons";
import SettingsPlugin from "@plugins/_core/settings";
import { removeFromArray } from "@utils/misc";
import definePlugin from "@utils/types";

import PresenceLabTab from "./PresenceLabTab";
import managedStyle from "./styles.css?managed";

const PRESENCE_LAB_SETTINGS_KEY = "kamidere_presence_lab";

function unregisterPresenceLabSettingsTab() {
    while (SettingsPlugin.customEntries.some(entry => entry.key === PRESENCE_LAB_SETTINGS_KEY)) {
        removeFromArray(SettingsPlugin.customEntries, entry => entry.key === PRESENCE_LAB_SETTINGS_KEY);
    }
}

function registerPresenceLabSettingsTab() {
    unregisterPresenceLabSettingsTab();

    SettingsPlugin.customEntries.push({
        key: PRESENCE_LAB_SETTINGS_KEY,
        title: "Kamidere Presence Lab",
        Component: PresenceLabTab,
        Icon: ComponentsIcon,
    });
}

export default definePlugin({
    name: "PresenceLab",
    description: "Local-only dashboard for operators, targets, and manually logged experimental presence sessions.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    enabledByDefault: false,
    managedStyle,
    tags: ["Developers", "Utility"],
    requiresRestart: false,

    start() {
        registerPresenceLabSettingsTab();
    },

    stop() {
        unregisterPresenceLabSettingsTab();
    },
});