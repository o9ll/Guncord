/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import { Logger } from "@utils/Logger";
import definePlugin, { OptionType, ReporterTestable } from "@utils/types";

import { initWs, socket, stopWs } from "./initWs";
export const PORT = 8485;
export const CLIENT_VERSION: readonly [major: number, minor: number, patch: number] = [0, 1, 3];

export const logger = new Logger("DevCompanion");

export const settings = definePluginSettings({
    notifyOnAutoConnect: {
        description: "Whether to notify when Dev Companion has automatically connected.",
        type: OptionType.BOOLEAN,
        default: true
    },
    usePatchedModule: {
        description: "On extract requests, reply with the current patched module (if it is patched) instead of the original.",
        default: true,
        type: OptionType.BOOLEAN,
    },
    reloadAfterToggle: {
        description: "Reload after a disable/enable plugin command is recived.",
        default: true,
        type: OptionType.BOOLEAN
    }
});

export default definePlugin({
    name: "DevCompanion",
    description: "Dev Companion Plugin. Please report anything not working or being weird (most likely its a bug) to sadan, either ping or dm, thanks!",
    tags: ["Developers", "Utility"],
    authors: [Devs.Ven, Devs.sadan],
    reporterTestable: ReporterTestable.None,
    isModified: true,
    settings,

    toolboxActions: {
        Reconnect() {
            socket?.close(1000, "Reconnecting");
            initWs(true);
        }
    },

    start() {
        // if we're running the reporter, we need to initws in the reporter file to avoid a race condition
        if (!IS_DEV) throw new Error("This plugin requires dev mode to run, please build with pnpm build --dev");
        initWs();
        window.reconnectDevtools = () => {
            socket?.close(1000, "Reconnecting");
            initWs(true);
        };
    },

    stop: stopWs,
});
