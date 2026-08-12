/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as types from "@guncordplugins/pluginLibrary/types";
import { findCssClassesLazy } from "@webpack";

export const panelClasses = findCssClassesLazy("button", "buttonContents", "buttonColor", "container", "actionButtons", "buttonIcon") as types.PanelClasses;

// waitFor(filters.byProps("button", "buttonContents", "buttonColor"), result => panelClasses = result);
