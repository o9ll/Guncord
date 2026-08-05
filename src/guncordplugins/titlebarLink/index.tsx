/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin, { PluginNative } from "@utils/types";

const Native = VencordNative.pluginHelpers.TitlebarLink as PluginNative<typeof import("./native")>;

const TARGET_URL = `https://github.com/o9ll`;

const CSS = `
#guncord-titlebar-btn {
    position: fixed;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    height: 15px;
    width: 40px;
    z-index: 9999;
    cursor: pointer !important;
    display: flex;
    align-items: center;
    justify-content: center;
    -webkit-app-region: no-drag;
    pointer-events: all;
    background: transparent;
    border: none;
    padding: 0;
}


`;

function inject() {
    if (document.getElementById("guncord-titlebar-btn")) return;

    const style = document.createElement("style");
    style.id = "guncord-titlebar-link-style";
    style.textContent = CSS;
    document.head.appendChild(style);

    const btn = document.createElement("div");
    btn.id = "guncord-titlebar-btn";

    btn.addEventListener("click", () => {
        Native.openUrl(TARGET_URL);
    });

    document.body.appendChild(btn);
}

function remove() {
    document.getElementById("guncord-titlebar-btn")?.remove();
    document.getElementById("guncord-titlebar-link-style")?.remove();
}

export default definePlugin({
    name: "TitlebarLink",
    description: "Click on the central Discord title to open o9 in GitHub",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    required: true,
    patches: [],

    start() {
        if (document.body) {
            inject();
        } else {
            document.addEventListener("DOMContentLoaded", inject, { once: true });
        }
    },

    stop() {
        remove();
    },
} as any);
