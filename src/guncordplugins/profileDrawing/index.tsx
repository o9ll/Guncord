/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";
import { startDrawingInjector, stopDrawingInjector } from "../../customization/profileDrawing/drawingInjector";
import { detachInteractiveCanvas, setDrawingMode } from "../../customization/profileDrawing/drawingManager";

export default definePlugin({
    name: "ProfileDrawing",
    description: "Draw directly on your profile with customizable brush colors and stroke sizes.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    enabledByDefault: false,

    start() {
        startDrawingInjector();
    },

    stop() {
        setDrawingMode(false);
        detachInteractiveCanvas();
        stopDrawingInjector();
    }
});

