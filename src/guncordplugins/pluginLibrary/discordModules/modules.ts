/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as types from "@guncordplugins/pluginLibrary/types";
import { filters, waitFor } from "@webpack";

export let utils: types.Utils;

waitFor(filters.byProps("getPidFromDesktopSource"), result => utils = result);
