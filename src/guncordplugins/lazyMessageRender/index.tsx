/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle, setStyleClassNames } from "@api/Styles";
import definePlugin from "@utils/types";
import { findCssClassesLazy } from "@webpack";

import style from "./style.css?managed";

const classes = findCssClassesLazy("messageListItem");

export default definePlugin({
    name: "LazyMessageRender",
    description: "Keeps the message action toolbar from clipping under the message above by lifting the hovered/focused row. (content-visibility was removed — Discord's virtualized scroller mis-measures contained rows after recent updates, causing scroll jumping.)",
    authors: [{ name: ".zp", id: 1020801845490356245n }],

    start() {
        setStyleClassNames(style, { messageListItem: classes.messageListItem });
        enableStyle(style);
    },

    stop() {
        disableStyle(style);
    }
});
