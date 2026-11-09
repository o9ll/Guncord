/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { createScopedPatcher } from "../patcher";
import * as storage from "../storage";

export interface PluginAuthor {
    name: string;
    id?: string;
}

export interface PluginContext {
    patcher: ReturnType<typeof createScopedPatcher>;
    storage: {
        get: <T = any>(key: string, defaultValue?: T) => T;
        set: (key: string, value: any) => void;
        remove: (key: string) => void;
    };
}

export interface MobilePlugin {
    name: string;
    description: string;
    authors?: PluginAuthor[];
    enabledByDefault?: boolean;
    start?: (ctx: PluginContext) => void | Promise<void>;
    stop?: () => void | Promise<void>;
    settings?: Record<string, any>;
}

export const plugins = new Map<string, MobilePlugin>();
const activeContexts = new Map<string, { patcher: ReturnType<typeof createScopedPatcher> }>();

export function definePlugin(plugin: MobilePlugin): MobilePlugin {
    plugins.set(plugin.name, plugin);
    return plugin;
}

export function isPluginEnabled(name: string): boolean {
    const plugin = plugins.get(name);
    if (!plugin) return false;
    return storage.get<boolean>(`plugin_enabled_${name}`, plugin.enabledByDefault ?? false);
}

export function setPluginEnabled(name: string, enabled: boolean): void {
    storage.set(`plugin_enabled_${name}`, enabled);
    if (enabled) {
        void startPlugin(name);
    } else {
        void stopPlugin(name);
    }
}

export async function startPlugin(name: string): Promise<boolean> {
    const plugin = plugins.get(name);
    if (!plugin) return false;
    if (activeContexts.has(name)) return true;

    const patcher = createScopedPatcher();
    const ctx: PluginContext = {
        patcher,
        storage: {
            get: <T = any>(key: string, defaultValue?: T) =>
                storage.get<T>(`plugin_${name}_${key}`, defaultValue),
            set: (key: string, value: any) =>
                storage.set(`plugin_${name}_${key}`, value),
            remove: (key: string) =>
                storage.remove(`plugin_${name}_${key}`)
        }
    };

    activeContexts.set(name, { patcher });

    try {
        await plugin.start?.(ctx);
        return true;
    } catch (e) {
        console.error(`[Guncord] Failed to start plugin "${name}":`, e);
        patcher.unpatchAll();
        activeContexts.delete(name);
        return false;
    }
}

export async function stopPlugin(name: string): Promise<boolean> {
    const plugin = plugins.get(name);
    const active = activeContexts.get(name);
    if (!plugin || !active) return false;

    try {
        await plugin.stop?.();
    } catch (e) {
        console.error(`[Guncord] Error stopping plugin "${name}":`, e);
    } finally {
        active.patcher.unpatchAll();
        activeContexts.delete(name);
    }

    return true;
}

export function startAllEnabled(): void {
    for (const [name] of plugins) {
        if (isPluginEnabled(name)) {
            void startPlugin(name);
        }
    }
}

export function stopAll(): void {
    for (const [name] of plugins) {
        if (activeContexts.has(name)) {
            void stopPlugin(name);
        }
    }
}

