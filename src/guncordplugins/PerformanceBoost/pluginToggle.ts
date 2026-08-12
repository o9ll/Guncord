/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { plugins } from "@api/PluginManager";
import { Settings } from "@api/Settings";

const GUN_ESSENTIALS = ["DiscordArabicizer", "PerformanceBoost"];

export function isEssentialPlugin(name: string): boolean {
    const p = (plugins as Record<string, { required?: boolean; isDependency?: boolean; }>)[name];
    return !!(p?.required || p?.isDependency) || GUN_ESSENTIALS.includes(name);
}

export function togglablePlugins(): string[] {
    return Object.keys(plugins).filter(n => !isEssentialPlugin(n)).sort((a, b) => a.localeCompare(b));
}

export function enabledTogglablePlugins(): string[] {
    return togglablePlugins().filter(n => Settings.plugins[n]?.enabled);
}

export function parseKeep(raw: string): string[] {
    return (raw || "").split(",").map(s => s.trim()).filter(Boolean);
}

export function enterPerformanceMode(keep: string[]): string[] {
    const keepSet = new Set(keep);
    const wasEnabled: string[] = [];
    for (const name of Object.keys(plugins)) {
        if (isEssentialPlugin(name)) continue;
        const s = Settings.plugins[name];
        if (!s) continue;
        if (s.enabled) wasEnabled.push(name);
        if (keepSet.has(name)) continue;
        s.enabled = false;
    }
    return wasEnabled;
}

export function exitPerformanceMode(saved: string[]): void {
    for (const name of saved) {
        const s = Settings.plugins[name];
        if (s) s.enabled = true;
    }
}
