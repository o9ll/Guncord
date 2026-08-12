/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import * as DataStore from "@api/DataStore";
import { HeaderBarButton } from "@api/HeaderBar";
import { showNotification } from "@api/Notifications";
import { popNotice, showNotice } from "@api/Notices";
import { getUserSettingLazy } from "@api/UserSettings";
import { Logger } from "@utils/Logger";
import { useForceUpdater } from "@utils/react";
import definePlugin, { PluginNative } from "@utils/types";
import { findAll, findStore } from "@webpack";
import { React, useEffect } from "@webpack/common";

import { settings } from "./settings";

const logger = new Logger("PerformanceBoost");

const Native = IS_DISCORD_DESKTOP
    ? (VencordNative.pluginHelpers.PerformanceBoost as PluginNative<typeof import("./native")>)
    : null;

let active = false;
let ready = false;
let readyFallbackTimer: ReturnType<typeof setTimeout> | null = null;
let manualOff = false;
let notifiedManualOff = false;
const HW_ACK_KEY = "PerformanceBoost_hwRestartAcknowledged";
const MANUAL_OFF_KEY = "PerformanceBoost_manualOff";
const buttonUpdaters = new Set<() => void>();
const refreshButtons = () => buttonUpdaters.forEach(u => u());

function markReady() {
    if (ready) return;
    ready = true;
    if (readyFallbackTimer !== null) {
        clearTimeout(readyFallbackTimer);
        readyFallbackTimer = null;
    }
}

const ORIG_COMPACT_KEY = "PerformanceBoost_originalCompact";
const ORIG_GIF_KEY = "PerformanceBoost_originalGif";

const NOTICE_COLORS = { success: "#3ba55c", warning: "#faa81a", error: "#ed4245", info: "#5865f2" } as const;
function notice(message: string, type: keyof typeof NOTICE_COLORS) {
    showNotification({ title: "PerformanceBoost", body: message, color: NOTICE_COLORS[type], noPersist: true });
}

function applyCss() {
    const root = document.documentElement;
    root.classList.toggle("vc-perfboost-no-anim", settings.store.disableAnimations);
    root.classList.toggle("vc-perfboost-hide-activities", settings.store.hideActivities);
    root.classList.add("vc-perfboost-active");
}
function removeCss() {
    document.documentElement.classList.remove("vc-perfboost-no-anim", "vc-perfboost-hide-activities", "vc-perfboost-active");
}

const PASSIVE_EVENTS = ["wheel", "mousewheel", "touchstart", "touchmove", "touchend"];
let originalAddEventListener: typeof EventTarget.prototype.addEventListener | null = null;
let springs: { Globals?: { assign?: (o: Record<string, unknown>) => void; }; }[] = [];

const CACHE_STORE_NAMES = [
    "MessageStore", "EmojiStore", "StickersStore", "UserProfileStore", "InviteStore",
    "ApplicationStore", "ExperimentStore", "QuestStore", "SoundboardStore", "SpellCheckStore",
    "RunningGameStore", "ApplicationStreamingStore", "ApplicationStreamPreviewStore",
    "UserAffinitiesStore", "ApplicationCommandIndexStore", "ReadStateStore", "TypingStore"
];

function clearStoreCaches() {
    let n = 0;
    for (const name of CACHE_STORE_NAMES) {
        try {
            const store = findStore(name) as { clearCache?: () => void; } | undefined;
            if (typeof store?.clearCache === "function") { store.clearCache(); n++; }
        } catch (e) { logger.warn(`clearCache ${name} failed`, e); }
    }
    if (typeof (window as any).gc === "function") { try { (window as any).gc(); } catch { /* gc unavailable */ } }
    logger.info(`Cleared ${n} store caches`);
}

function applyRuntimeOpts() {
    if (settings.store.skipSpringAnimations && springs.length === 0) {
        springs = findAll(m => typeof (m as any)?.Globals === "object" && typeof (m as any)?.Springs === "object") as typeof springs;
        for (const s of springs) s.Globals?.assign?.({ skipAnimation: true });
    }
    if (settings.store.passiveListeners && !originalAddEventListener) {
        originalAddEventListener = EventTarget.prototype.addEventListener;
        const orig = originalAddEventListener;
        EventTarget.prototype.addEventListener = function (this: EventTarget, type: string, listener: any, options?: any) {
            if (PASSIVE_EVENTS.includes(type) && listener != null) {
                if (typeof options === "boolean" || options === undefined) options = { capture: !!options, passive: true };
                else if (options.passive === undefined) options = { ...options, passive: true };
            }
            return orig.call(this, type, listener, options);
        } as typeof EventTarget.prototype.addEventListener;
    }
    if (settings.store.lazyImages) {
        const isChatImage = (img: HTMLImageElement) =>
            img.closest('[class*="scrollerInner_"], [class*="messageListItem_"]') !== null;
        document.querySelectorAll<HTMLImageElement>("img").forEach(img => {
            if (isChatImage(img)) return;
            if (!img.loading) img.loading = "lazy";
            if (!img.decoding) img.decoding = "async";
        });
    }
    if (settings.store.clearStoreCaches) clearStoreCaches();
}

function removeRuntimeOpts() {
    for (const s of springs) s.Globals?.assign?.({ skipAnimation: false });
    springs = [];
    if (originalAddEventListener) {
        EventTarget.prototype.addEventListener = originalAddEventListener;
        originalAddEventListener = null;
    }
}

async function applyUserSettings() {
    try {
        const compactSetting = getUserSettingLazy("textAndImages", "messageDisplayCompact");
        if (compactSetting?.updateSetting && typeof compactSetting.getSetting === "function") {
            const original = compactSetting.getSetting();
            if (original !== undefined && (await DataStore.get(ORIG_COMPACT_KEY)) === undefined) {
                await DataStore.set(ORIG_COMPACT_KEY, original);
            }
            if (settings.store.compactMode) compactSetting.updateSetting(true);
        }
    } catch (e) { logger.warn("Failed to set compact mode", e); }

    try {
        const gifSetting = getUserSettingLazy("textAndImages", "gifAutoPlay");
        if (gifSetting?.updateSetting && typeof gifSetting.getSetting === "function") {
            const original = gifSetting.getSetting();
            if (original !== undefined && (await DataStore.get(ORIG_GIF_KEY)) === undefined) {
                await DataStore.set(ORIG_GIF_KEY, original);
            }
            if (settings.store.disableGifAutoplay) gifSetting.updateSetting(false);
        }
    } catch (e) { logger.warn("Failed to set GIF autoplay", e); }
}

async function revertUserSettings() {
    try {
        const originalCompact = await DataStore.get<boolean>(ORIG_COMPACT_KEY);
        if (originalCompact !== undefined) {
            const compactSetting = getUserSettingLazy("textAndImages", "messageDisplayCompact");
            if (compactSetting?.updateSetting) await compactSetting.updateSetting(originalCompact);
            await DataStore.del(ORIG_COMPACT_KEY);
        }
    } catch (e) { logger.warn("Failed to revert compact mode", e); }

    try {
        const originalGif = await DataStore.get<boolean>(ORIG_GIF_KEY);
        if (originalGif !== undefined) {
            const gifSetting = getUserSettingLazy("textAndImages", "gifAutoPlay");
            if (gifSetting?.updateSetting) await gifSetting.updateSetting(originalGif);
            await DataStore.del(ORIG_GIF_KEY);
        }
    } catch (e) { logger.warn("Failed to revert GIF autoplay", e); }
}

async function setPriority(level: "belowNormal" | "normal") {
    if (!Native) { notice("Changing priority requires the desktop app.", "warning"); return; }
    try {
        const res = await Native.setProcessPriority(level);
        if (res.ok && level === "belowNormal") notice(`Lowered priority for ${res.changed} process(es)`, "success");
        else if (!res.ok) notice("Priority change unavailable: " + res.reason, "warning");
    } catch (e) { logger.error("setPriority failed", e); }
}

async function cleanCache() {
    if (!Native) { notice("Cache cleaning requires the desktop app.", "warning"); return; }
    try {
        const res = await Native.cleanCache();
        notice(res.ok ? `Cache cleaned (${res.cleared}).` : "Could not clean cache", res.ok ? "success" : "warning");
    } catch (e) { logger.error("cleanCache failed", e); }
}

let restarting = false;
async function doRestart() {
    if (restarting) return;
    restarting = true;
    notice("Restarting...", "success");
    popNotice();
    try {
        if (!Native) { location.reload(); return; }
        await Native.relaunchApp();
    } catch (e) {
        logger.error("restart failed", e);
        restarting = false;
        location.reload();
    }
}

async function promptHardwareRestart() {
    if (await DataStore.get(HW_ACK_KEY)) return;
    await DataStore.set(HW_ACK_KEY, true);
    showNotice(
        "To disable hardware acceleration: turn it off manually in Discord Settings → Advanced, then restart.",
        "Restart now",
        doRestart
    );
}

let loadTimer: ReturnType<typeof setInterval> | null = null;
let highStreak = 0, lowStreak = 0;
let autoByLoad = false;

async function sampleLoad() {
    if (!Native || !settings.store.autoHighLoad) return;
    try {
        const cpu = await Native.getTotalCpu();
        const threshold = settings.store.cpuThreshold ?? 160;
        if (cpu >= threshold) { highStreak++; lowStreak = 0; }
        else if (cpu < threshold * 0.6) { lowStreak++; highStreak = 0; }
        else { highStreak = 0; lowStreak = 0; }

        if (!active && !manualOff && highStreak >= 2) {
            highStreak = 0;
            autoByLoad = true;
            await applyMode();
            notice(`High CPU usage (${Math.round(cpu)}%) — performance mode enabled automatically.`, "info");
        } else if (active && autoByLoad && lowStreak >= 2) {
            lowStreak = 0;
            autoByLoad = false;
            await revertMode();
        }
    } catch (e) { logger.warn("load sample failed", e); }
}

function startLoadMonitor() {
    if (loadTimer !== null || !Native) return;
    highStreak = 0; lowStreak = 0;
    loadTimer = setInterval(sampleLoad, 30_000);
}

function stopLoadMonitor() {
    if (loadTimer !== null) { clearInterval(loadTimer); loadTimer = null; }
    highStreak = 0; lowStreak = 0;
    autoByLoad = false;
}

async function applyMode() {
    if (active) return;
    active = true;
    notifiedManualOff = false;
    applyCss();
    applyRuntimeOpts();
    await applyUserSettings();
    if (settings.store.changeProcessPriority) await setPriority("belowNormal");
    if (settings.store.cleanCacheOnStart) await cleanCache();
    if (settings.store.reduceHardwareAcceleration) await promptHardwareRestart();
    refreshButtons();
    notice("Performance mode enabled ⚡", "success");
}

async function revertMode() {
    if (!active) return;
    active = false;
    removeCss();
    removeRuntimeOpts();
    await revertUserSettings();
    if (settings.store.changeProcessPriority) await setPriority("normal");
    refreshButtons();
    notice("Performance mode disabled", "success");
}

function toggle() {
    autoByLoad = false;
    if (active) {
        revertMode();
        manualOff = true;
    } else {
        applyMode();
        manualOff = false;
    }
    settings.store.gameMode = active;
    DataStore.set(MANUAL_OFF_KEY, manualOff);
}

function BoltIcon({ active: isActive }: { active: boolean; }) {
    const color = isActive ? "#3ba55c" : "#ed4245";
    return (
        <svg width={20} height={20} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="1">
            <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" />
        </svg>
    );
}

function PerfHeaderButton() {
    const forceUpdate = useForceUpdater();
    useEffect(() => {
        buttonUpdaters.add(forceUpdate);
        return () => void buttonUpdaters.delete(forceUpdate);
    }, []);
    return (
        <HeaderBarButton
            icon={() => <BoltIcon active={active} />}
            tooltip={active ? "Disable performance mode" : "Enable performance mode"}
            onClick={toggle}
        />
    );
}

export default definePlugin({
    name: "PerformanceBoost",
    description: "Game/performance mode: reduces animations, compacts messages, stops GIFs, lowers process priority, cleans cache, and applies runtime speedups (spring skip, passive listeners, lazy images, memory-freeing) — all revertible. (Hardware acceleration requires one-time manual toggle + restart.)",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    tags: ["Utility"],
    dependencies: ["HeaderBarAPI"],
    settings,
    headerBarButton: { icon: () => <BoltIcon active={active} />, render: PerfHeaderButton },
    flux: {
        CONNECTION_OPEN() {
            markReady();
        },
        RUNNING_GAMES_CHANGE({ games }: { games: { id: string; }[]; }) {
            if (!settings.store.autoDetectGames || !ready) return;

            if (manualOff) {
                if (games?.length && !notifiedManualOff) {
                    notice("Auto-enable is disabled because you turned off Performance mode manually. Re-enable it from the button or settings.", "info");
                    notifiedManualOff = true;
                }
                return;
            }

            if (games?.length) { if (!active) applyMode(); }
            else if (active) revertMode();
        }
    },
    async start() {
        manualOff = (await DataStore.get<boolean>(MANUAL_OFF_KEY)) ?? false;
        if (settings.store.gameMode) await applyMode();
        else await revertUserSettings();
        readyFallbackTimer = setTimeout(markReady, 15000);
        startLoadMonitor();
    },
    stop() {
        stopLoadMonitor();
        revertMode();
        removeRuntimeOpts();
        if (readyFallbackTimer !== null) {
            clearTimeout(readyFallbackTimer);
            readyFallbackTimer = null;
        }
        ready = false;
        notifiedManualOff = false;
    }
});
