/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import * as types from "@guncordplugins/pluginLibrary/types";
import { waitForStore } from "@webpack/common/internal";

export let MediaEngineStore: types.MediaEngineStore;

waitForStore("MediaEngineStore", store => MediaEngineStore = store);
