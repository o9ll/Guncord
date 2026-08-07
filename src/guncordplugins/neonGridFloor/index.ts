/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { disableStyle, enableStyle } from "@api/Styles";
import definePlugin from "@utils/types";

import style from "./style.css?managed";

export default definePlugin({
    name: "NeonGridFloor",
    description: "Scrolling retro grid floor along the bottom of the window.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    start: () => enableStyle(style),
    stop: () => disableStyle(style),
});
