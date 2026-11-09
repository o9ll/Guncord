/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ReactNative } from "../metro/common";

const memoryStore = new Map<string, any>();
const STORAGE_PREFIX = "GUNCORD_MOBILE_";

function getNativeMMKV(): any {
    const RN = ReactNative.current;
    return RN?.NativeModules?.MMKVManager || (globalThis as any).MMKVManager;
}

export function initStorage(): void {
    const mmkv = getNativeMMKV();
    if (mmkv?.getItem) {
        try {
            // Load initial keys if possible
        } catch {}
    }
}

export function get<T = any>(key: string, defaultValue?: T): T {
    const fullKey = STORAGE_PREFIX + key;
    if (memoryStore.has(fullKey)) {
        return memoryStore.get(fullKey);
    }

    try {
        const mmkv = getNativeMMKV();
        if (mmkv?.getString) {
            const val = mmkv.getString(fullKey);
            if (val !== undefined && val !== null) {
                const parsed = JSON.parse(val);
                memoryStore.set(fullKey, parsed);
                return parsed;
            }
        }
    } catch {}

    return defaultValue as T;
}

export function set(key: string, value: any): void {
    const fullKey = STORAGE_PREFIX + key;
    memoryStore.set(fullKey, value);

    try {
        const mmkv = getNativeMMKV();
        const serialized = JSON.stringify(value);
        if (mmkv?.setString) {
            mmkv.setString(fullKey, serialized);
        } else if (mmkv?.setItem) {
            mmkv.setItem(fullKey, serialized);
        }
    } catch {}
}

export function remove(key: string): void {
    const fullKey = STORAGE_PREFIX + key;
    memoryStore.delete(fullKey);

    try {
        const mmkv = getNativeMMKV();
        if (mmkv?.removeItem) {
            mmkv.removeItem(fullKey);
        }
    } catch {}
}

export function clear(): void {
    memoryStore.clear();
}

