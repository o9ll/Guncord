/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { disableStyle, enableStyle, setStyleClassNames } from "@api/Styles";
import definePlugin, { OptionType } from "@utils/types";
import { findCssClassesLazy } from "@webpack";

import fadeStyle from "./fade.css?managed";
import slideStyle from "./slide.css?managed";

const messageClasses = findCssClassesLazy("messageListItem");

function applyStyle() {
    disableStyle(fadeStyle);
    disableStyle(slideStyle);
    enableStyle(settings.store.includeFade ? fadeStyle : slideStyle);
}

const settings = definePluginSettings({
    includeFade: {
        type: OptionType.BOOLEAN,
        description: "Fade messages in while they slide.",
        default: true,
        onChange: applyStyle
    }
});

export default definePlugin({
    name: "SmoothMessages",
    description: "Makes new messages slide in smoothly from the left instead of appearing sharply.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    settings,

    start() {
        setStyleClassNames(fadeStyle, { messageListItem: messageClasses.messageListItem });
        setStyleClassNames(slideStyle, { messageListItem: messageClasses.messageListItem });
        applyStyle();
    },

    stop() {
        disableStyle(fadeStyle);
        disableStyle(slideStyle);
    }
});
