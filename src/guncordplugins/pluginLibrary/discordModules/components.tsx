/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { types } from "@guncordplugins/pluginLibrary";
import { LazyComponent } from "@utils/react";
import { findByCode } from "@webpack";

export const UserSummaryItem = LazyComponent<React.ComponentProps<types.UserSummaryItem>>(() => findByCode("defaultRenderUser", "showDefaultAvatarsForNullUsers"));
