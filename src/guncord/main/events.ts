/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { EventEmitter } from "events";

import { UserAssetType } from "./userAssets";

export const AppEvents = new EventEmitter<{
    appLoaded: [];
    userAssetChanged: [UserAssetType];
    setTrayVariant: ["tray" | "trayUnread" | "traySpeaking" | "trayIdle" | "trayMuted" | "trayDeafened"];
    voiceCallStateChanged: [boolean];
}>();

// FIX MEMORY LEAK: without setMaxListeners, Node.js warns at 11+ listeners
// and may retain references even after removeListener() in some cases.
// Set to 20: tray (2) + appBadge (1) + ipc (1) + future listeners = more than enough.
AppEvents.setMaxListeners(20);
