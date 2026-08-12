/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { addChannelToolbarButton, addHeaderBarButton, removeChannelToolbarButton, removeHeaderBarButton } from "@api/HeaderBar";
import definePlugin from "@utils/types";
import { React } from "@webpack/common";

import { MemberListToolbarButton } from "./memberList";
import { ExportMessagesButton } from "./messages";
import { settings } from "./settings";

export default definePlugin({
    name: "Exporter",
    enabledByDefault: false,
    description: "Export a channel's messages (TXT/JSON/CSV/MD/HTML) and its member list (JSON/CSV).",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    tags: ["Servers", "Utility"],
    dependencies: ["HeaderBarAPI"],
    settings,

    start() {
        addHeaderBarButton("esharq-exporter-messages", () => <ExportMessagesButton />, 4);
        addChannelToolbarButton("esharq-exporter-memberlist", () => <MemberListToolbarButton />, 5);
    },

    stop() {
        removeHeaderBarButton("esharq-exporter-messages");
        removeChannelToolbarButton("esharq-exporter-memberlist");
    }
});
