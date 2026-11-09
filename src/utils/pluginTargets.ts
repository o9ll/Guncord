/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export const PluginTargets = ["web", "browser", "discordDesktop", "vesktop", "equibop", "desktop", "dev"] as const;
export type PluginTarget = typeof PluginTargets[number];

