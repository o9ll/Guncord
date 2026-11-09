/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IconsDef } from "@guncordplugins/iconViewer/types";
import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export let iconsModule: IconsDef = {};

type IconListener = (icons: IconsDef) => void;
const iconListeners = new Set<IconListener>();

export function onIconsLoaded(cb: IconListener) {
    if (iconsModule && Object.keys(iconsModule).length > 0) {
        try {
            cb(iconsModule);
        } catch (e) {
            console.error("[ConcatenatedModules] Error in listener callback:", e);
        }
    }
    iconListeners.add(cb);
    return () => iconListeners.delete(cb);
}

let iconLoaderRef: (((path: string) => Promise<IconsDef>) & { keys(): string[]; }) | null = null;
let isLoadingIcons = false;

export async function ensureIconsLoaded(): Promise<IconsDef> {
    if (iconsModule && Object.keys(iconsModule).length > 0) return iconsModule;
    if (isLoadingIcons) return iconsModule;

    if (iconLoaderRef) {
        isLoadingIcons = true;
        try {
            const keys = iconLoaderRef.keys();
            const modules = await Promise.all(keys.map(k => iconLoaderRef!(k).catch(() => ({}))));
            const merged = Object.assign({}, ...modules);
            setIcons(merged);
        } catch (err) {
            console.error("[ConcatenatedModules] Failed to load icons:", err);
        } finally {
            isLoadingIcons = false;
        }
    }

    return iconsModule;
}

function setIcons(value: IconsDef) {
    iconsModule = value;
    for (const cb of iconListeners) {
        try {
            cb(value);
        } catch (e) {
            console.error("[ConcatenatedModules] Error in icon listener:", e);
        }
    }
}

export default definePlugin({
    name: "ConcatenatedModules",
    description: "Extract modules that have been concatenated by the bundler",
    authors: [Devs.Ven, Devs.thororen],

    required: true,

    patches: [
        {
            find: ".web.tsx`",
            replacement: {
                match: /function \i\(\i\)\{let \i,\{badgeIcon:(?=.{0,400}\?\?=(\i\(\d+\));let \i=`\.\/\$\{\i\}\.web\.tsx`)/,
                replace: "$self.loadIcons($1);$&"
            }
        }
    ],

    async loadIcons(load: ((path: string) => Promise<IconsDef>) & { keys(): string[]; }) {
        if (!load || typeof load.keys !== "function") return;
        iconLoaderRef = load;
        (this as any).iconLoader = load;

        // Load deferred via requestIdleCallback / setTimeout to avoid blocking initial startup
        const doLoad = async () => {
            if (iconsModule && Object.keys(iconsModule).length > 0) return;
            isLoadingIcons = true;
            try {
                const keys = load.keys();
                const modules = await Promise.all(keys.map(k => load(k).catch(() => ({}))));
                const merged = Object.assign({}, ...modules);
                this.setIconsModule(merged);
            } catch (err) {
                console.error("[ConcatenatedModules] Failed to load icons:", err);
            } finally {
                isLoadingIcons = false;
            }
        };

        if (typeof window !== "undefined" && "requestIdleCallback" in window) {
            (window as any).requestIdleCallback(doLoad, { timeout: 3000 });
        } else {
            setTimeout(doLoad, 400);
        }
    },

    setIconsModule(value: IconsDef) {
        setIcons(value);
        this.iconsModule = value;
    },
});

