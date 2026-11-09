/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { byName, byProps, byStoreName, byTypeName, Filter } from "./filters";

export * from "./filters";
export * as filters from "./filters";
export * as common from "./common";

type ModuleId = number | string;

export interface MetroModule {
    id: ModuleId;
    isInitialized: boolean;
    publicWorkers?: any;
    factory?: any;
    exports: any;
}

const modules = new Map<ModuleId, any>();
const listeners = new Set<(module: any) => void>();

function getMetroRequire(): any {
    const g = globalThis as any;
    return g.__r || g.require;
}

export function initializeMetro(): void {
    const g = globalThis as any;

    if (g.__d) {
        const originalDefine = g.__d;
        g.__d = function (factory: any, moduleId: ModuleId, dependencyMap: any) {
            const result = originalDefine.apply(this, arguments);
            try {
                const req = getMetroRequire();
                if (req) {
                    const mod = req(moduleId);
                    if (mod) {
                        modules.set(moduleId, mod);
                        for (const listener of listeners) {
                            try {
                                listener(mod);
                            } catch {}
                        }
                    }
                }
            } catch {}
            return result;
        };
        g.__d.guncord = true;
    }
}

export function getModules(): any[] {
    const g = globalThis as any;
    const req = getMetroRequire();

    // If Metro has an internal module cache accessible
    if (g.modules) {
        return Object.values(g.modules);
    }

    if (req?.getModules) {
        const raw = req.getModules();
        return Object.values(raw).map((m: any) => m?.publicWorkers?.exports || m?.exports || m);
    }

    // Fallback: collect known mapped modules or scan a reasonable ID range
    if (modules.size > 0) {
        return Array.from(modules.values());
    }

    if (typeof req === "function") {
        const scanned: any[] = [];
        for (let i = 0; i < 20000; i++) {
            try {
                const m = req(i);
                if (m) {
                    modules.set(i, m);
                    scanned.push(m);
                }
            } catch {}
        }
        return scanned;
    }

    return [];
}

export function find(filter: Filter): any {
    const all = getModules();
    for (const m of all) {
        if (!m) continue;
        if (filter(m)) return m;
        if (m.default && filter(m.default)) return m.default;
    }
    return undefined;
}

export function findAll(filter: Filter): any[] {
    const all = getModules();
    const results: any[] = [];
    for (const m of all) {
        if (!m) continue;
        if (filter(m)) results.push(m);
        else if (m.default && filter(m.default)) results.push(m.default);
    }
    return results;
}

export function findByProps<T = any>(...props: string[]): T | undefined {
    return find(byProps(...props));
}

export function findAllByProps<T = any>(...props: string[]): T[] {
    return findAll(byProps(...props));
}

export function findByName<T = any>(name: string, defaultExport = true): T | undefined {
    return find(byName(name, defaultExport));
}

export function findByTypeName<T = any>(typeName: string): T | undefined {
    return find(byTypeName(typeName));
}

export function findByStoreName<T = any>(name: string): T | undefined {
    return find(byStoreName(name));
}

export function waitFor(filter: Filter, timeoutMs = 10000): Promise<any> {
    const existing = find(filter);
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve, reject) => {
        let timer: any;
        const handler = (mod: any) => {
            if (filter(mod) || (mod.default && filter(mod.default))) {
                listeners.delete(handler);
                clearTimeout(timer);
                resolve(mod.default && filter(mod.default) ? mod.default : mod);
            }
        };
        listeners.add(handler);

        timer = setTimeout(() => {
            listeners.delete(handler);
            reject(new Error("Timeout waiting for Metro module"));
        }, timeoutMs);
    });
}

