/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
    name: "HideServerActivity",
    description: "Hides the 'Activity' from server members list.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    tags: ["Privacy", "Servers"],
    enabledByDefault: false,

    start() {
        const hideActivity = () => {
        const aside = document.querySelector('aside[class*="membersWrap"]');
        if (!aside) return;

        var el = aside.querySelector('h3');
        if (el.style.display === "none" || !el.textContent.includes("Activity")) return;
        el.style.display = "none";

        var allDivs = aside.querySelectorAll('div');
        Array.from(allDivs).filter(div => div.attributes.length === 0).forEach(card => {
        card.style.display = "none";
        });
    };

    hideActivity();

    const observer = new MutationObserver(() => hideActivity());
    observer.observe(document.body, { childList: true, subtree: true });
    },
    stop() {}
});