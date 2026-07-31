/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

export default definePlugin({
    name: "OverlayFix",
    description: "Attempts to fix the overlay by tricking Discord about the process name (masquerades as discord.exe).",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    cannotBeDisabled: false,
    enabledByDefault: false,
    requiresRestart: true,

    start() {
        try {
            if (typeof window.DiscordNative !== "undefined") {
                const originalNative = window.DiscordNative;

                try {
                    const proxy = new Proxy(originalNative, {
                        get(target, prop) {
                            const value = target[prop as keyof typeof target];
                            if (prop === "processUtils" && value) {
                                return new Proxy(value, {
                                    get(pTarget, pProp) {
                                        const pValue = pTarget[pProp as keyof typeof pTarget];
                                        if (pProp === "getMainArgv" && typeof pValue === "function") {
                                            return (...args: any[]) => {
                                                const argv = pValue.apply(pTarget, args);
                                                if (Array.isArray(argv) && argv[0]) {
                                                    argv[0] = argv[0].replace(/guncord\.exe/i, "discord.exe");
                                                }
                                                return argv;
                                            };
                                        }
                                        return typeof pValue === "function" ? pValue.bind(pTarget) : pValue;
                                    }
                                });
                            }
                            return typeof value === "function" ? value.bind(target) : value;
                        }
                    });

                    Object.defineProperty(window, "DiscordNative", {
                        value: proxy,
                        configurable: true,
                        enumerable: true,
                        writable: true
                    });

                    console.log("[OverlayFix] Process name spoofing active via defineProperty Proxy");
                } catch (e) {
                    console.warn("[OverlayFix] Could not redefine DiscordNative on window, attempting sub-property patch...");
                }
            }
        } catch (e) {
            console.error("[OverlayFix] Failed to setup spoofing:", e);
        }
    },

    patches: [
        {
            find: "window.DiscordNative.nativeModules.install",
            replacement: {
                match: /"discord_desktop_overlay"/,
                replace: "\"discord_desktop_overlay\", {force: true}"
            }
        }
    ]
});
