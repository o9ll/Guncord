/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type Filter = (module: any) => boolean;

export function byProps(...props: string[]): Filter {
    return (m: any) => {
        if (!m || typeof m !== "object") return false;
        return props.every(p => p in m);
    };
}

export function byName(name: string, defaultExport = true): Filter {
    return (m: any) => {
        if (!m) return false;
        if (defaultExport && m.default) {
            return m.default.displayName === name || m.default.name === name;
        }
        return m.displayName === name || m.name === name;
    };
}

export function byTypeName(typeName: string): Filter {
    return (m: any) => {
        if (!m) return false;
        const target = m.default ?? m;
        return target.type?.name === typeName || target.type?.displayName === typeName;
    };
}

export function byStoreName(storeName: string): Filter {
    return (m: any) => {
        if (!m) return false;
        const target = m.default ?? m;
        return target.getName?.() === storeName || target.constructor?.name === storeName;
    };
}

