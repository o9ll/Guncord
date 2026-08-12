/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
    name: "HideFormFullscreen",
    description: "Hides the chat input during fullscreen DM calls",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    tags: ["Appearance", "Utility"],
    enabledByDefault: false,
    start() {
        const s = document.createElement("style");
        s.id = "hff";
        document.head.appendChild(s);
        const u = () => {
            s.textContent = document.querySelector(".fullScreen_cb9592")
                ? ".form_f75fb0{display:none!important}"
                : "";
        };
        this.ob = new MutationObserver(u);
        this.ob.observe(document.body, {
            childList: true,
            subtree: false,
            attributes: true,
            attributeFilter: ["class"]
        });
        u();
    },
    stop() {
        this.ob?.disconnect();
        document.getElementById("hff")?.remove();
    }
});