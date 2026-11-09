/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type PatchType = "before" | "after" | "instead";

export interface PatchHook {
    type: PatchType;
    callback: (...args: any[]) => any;
    unpatch: () => void;
}

interface PatchedFunctionMeta {
    original: (...args: any[]) => any;
    befores: Set<(...args: any[]) => any>;
    afters: Set<(...args: any[]) => any>;
    insteads: Set<(...args: any[]) => any>;
}

const patchMap = new WeakMap<object, Map<string, PatchedFunctionMeta>>();
const globalUnpatches = new Set<() => void>();

function getOrCreateMeta(parent: any, prop: string): PatchedFunctionMeta {
    let propMap = patchMap.get(parent);
    if (!propMap) {
        propMap = new Map();
        patchMap.set(parent, propMap);
    }

    let meta = propMap.get(prop);
    if (!meta) {
        const original = parent[prop];
        if (typeof original !== "function") {
            throw new TypeError(`Cannot patch non-function property "${prop}"`);
        }

        meta = {
            original,
            befores: new Set(),
            afters: new Set(),
            insteads: new Set()
        };
        propMap.set(prop, meta);

        parent[prop] = function (...args: any[]) {
            const currentMeta = propMap!.get(prop);
            if (!currentMeta) return original.apply(this, args);

            let currentArgs = args;
            for (const beforeCb of currentMeta.befores) {
                try {
                    const res = beforeCb.call(this, currentArgs);
                    if (Array.isArray(res)) currentArgs = res;
                } catch (e) {
                    console.error(`[Guncord Patcher] Error in "before" hook on ${prop}:`, e);
                }
            }

            let result: any;
            if (currentMeta.insteads.size > 0) {
                const insteadCb = Array.from(currentMeta.insteads)[currentMeta.insteads.size - 1];
                try {
                    result = insteadCb.call(this, currentArgs, currentMeta.original.bind(this));
                } catch (e) {
                    console.error(`[Guncord Patcher] Error in "instead" hook on ${prop}:`, e);
                    result = currentMeta.original.apply(this, currentArgs);
                }
            } else {
                result = currentMeta.original.apply(this, currentArgs);
            }

            for (const afterCb of currentMeta.afters) {
                try {
                    const res = afterCb.call(this, currentArgs, result);
                    if (res !== undefined) result = res;
                } catch (e) {
                    console.error(`[Guncord Patcher] Error in "after" hook on ${prop}:`, e);
                }
            }

            return result;
        };

        // Preserve non-enumerable / properties of original
        Object.assign(parent[prop], original);
    }

    return meta;
}

function cleanUpIfEmpty(parent: any, prop: string, meta: PatchedFunctionMeta) {
    if (meta.befores.size === 0 && meta.afters.size === 0 && meta.insteads.size === 0) {
        parent[prop] = meta.original;
        const propMap = patchMap.get(parent);
        if (propMap) {
            propMap.delete(prop);
        }
    }
}

export function before(parent: any, prop: string, callback: (args: any[]) => any[] | void): () => void {
    if (!parent) throw new Error(`[Guncord Patcher] Parent is undefined for prop "${prop}"`);
    const meta = getOrCreateMeta(parent, prop);
    meta.befores.add(callback);

    const unpatch = () => {
        meta.befores.delete(callback);
        cleanUpIfEmpty(parent, prop, meta);
        globalUnpatches.delete(unpatch);
    };

    globalUnpatches.add(unpatch);
    return unpatch;
}

export function after(parent: any, prop: string, callback: (args: any[], res: any) => any | void): () => void {
    if (!parent) throw new Error(`[Guncord Patcher] Parent is undefined for prop "${prop}"`);
    const meta = getOrCreateMeta(parent, prop);
    meta.afters.add(callback);

    const unpatch = () => {
        meta.afters.delete(callback);
        cleanUpIfEmpty(parent, prop, meta);
        globalUnpatches.delete(unpatch);
    };

    globalUnpatches.add(unpatch);
    return unpatch;
}

export function instead(parent: any, prop: string, callback: (args: any[], orig: (...args: any[]) => any) => any): () => void {
    if (!parent) throw new Error(`[Guncord Patcher] Parent is undefined for prop "${prop}"`);
    const meta = getOrCreateMeta(parent, prop);
    meta.insteads.add(callback);

    const unpatch = () => {
        meta.insteads.delete(callback);
        cleanUpIfEmpty(parent, prop, meta);
        globalUnpatches.delete(unpatch);
    };

    globalUnpatches.add(unpatch);
    return unpatch;
}

export function createScopedPatcher() {
    const localUnpatches = new Set<() => void>();

    return {
        before(parent: any, prop: string, callback: (args: any[]) => any[] | void) {
            const unpatch = before(parent, prop, callback);
            localUnpatches.add(unpatch);
            return () => {
                unpatch();
                localUnpatches.delete(unpatch);
            };
        },
        after(parent: any, prop: string, callback: (args: any[], res: any) => any | void) {
            const unpatch = after(parent, prop, callback);
            localUnpatches.add(unpatch);
            return () => {
                unpatch();
                localUnpatches.delete(unpatch);
            };
        },
        instead(parent: any, prop: string, callback: (args: any[], orig: (...args: any[]) => any) => any) {
            const unpatch = instead(parent, prop, callback);
            localUnpatches.add(unpatch);
            return () => {
                unpatch();
                localUnpatches.delete(unpatch);
            };
        },
        unpatchAll() {
            for (const unpatch of localUnpatches) {
                try {
                    unpatch();
                } catch {}
            }
            localUnpatches.clear();
        }
    };
}

export function unpatchAll(): void {
    for (const unpatch of globalUnpatches) {
        try {
            unpatch();
        } catch {}
    }
    globalUnpatches.clear();
}

