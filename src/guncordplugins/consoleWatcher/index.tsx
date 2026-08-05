/*
 * ConsoleWatcher — A developer tool for monitoring and collecting console events for maintenance.
 * Copyright (c) 2026 o9
 *
 * Based on Equicord, licensed under GPL-3.0 or later, and subject to the same license. Functions are intercepted.
 * The console only works during active recording, then fully restores the original upon stopping — no
 * Memory leak with no effect on the main process (it only works on the display end).
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { addHeaderBarButton, HeaderBarButton, removeHeaderBarButton } from "@api/HeaderBar";
import { isPluginEnabled } from "@api/PluginManager";
import ErrorBoundary from "@components/ErrorBoundary";
import { gitHashShort } from "@shared/vencordUserAgent";
import { copyWithToast } from "@utils/discord";
import definePlugin from "@utils/types";
import { saveFile } from "@utils/web";
import type { RenderModalProps } from "@vencord/discord-types";
import { Button, FluxDispatcher, Modal, openModal, useEffect, useState } from "@webpack/common";
import { getBuildNumber } from "@webpack/patcher";

import Plugins from "~plugins";

import { settings } from "./settings";
import type { ConsoleEvent, ConsoleEventType, ErrorGroup } from "./types";
import {
    attributeProbablePlugin, buildAttributionIndex, cleanConsoleArgs,
    clearAttributionIndex, detectSource, groupErrors, redactSecrets, safeSerializeArg
} from "./utilities";

const BUTTON_ID = "ConsoleWatcher";

const HOOKED_METHODS = [
    "log", "warn", "error", "info", "debug", "trace",
    "table", "group", "groupCollapsed", "groupEnd",
    "time", "timeEnd", "clear"
] as const;
type HookedMethod = typeof HOOKED_METHODS[number];

const events: ConsoleEvent[] = [];
const original: Partial<Record<HookedMethod, (...a: any[]) => void>> = {};

let recording = false;
let hooked = false;
let capturing = false; // Re-entry guard — prevents infinite recursion
let errorCount = 0;    // Live error counter — shown in the button tooltip while recording

// ── Flux breadcrumbs — context for "what happened right before the error" ─────
// Recording only: wrap FluxDispatcher.dispatch to store the latest event types in
// a small ring buffer (type only — no payload, preserves privacy and memory). Safe
// unwrapping with a dead flag: if another wrapper is added after ours, the chain
// stays intact — our wrapper simply becomes a fully inactive pass-through.
const CRUMB_RING = 30;
const crumbs: string[] = [];
// Each wrapper keeps its original function and dead flag in its own closure, so it
// stays intact even if other wrappers remain in the chain after unwrapping (it just
// becomes a transparent inactive pass-through).
let activeUnwrap: (() => void) | null = null;

function wrapDispatch() {
    if (activeUnwrap) return;
    try {
        const fd = FluxDispatcher as any;
        const orig = fd.dispatch as (...a: any[]) => any;
        const state = { dead: false };
        const wrapper = function (this: any, ...args: any[]) {
            if (!state.dead) {
                try {
                    const type = args[0]?.type;
                    if (typeof type === "string") {
                        crumbs.push(type);
                        if (crumbs.length > CRUMB_RING) crumbs.shift();
                    }
                } catch { /* Crumbs never hurt */ }
            }
            return orig.apply(this, args);
        };
        fd.dispatch = wrapper;
        activeUnwrap = () => {
            try {
                if (fd.dispatch === wrapper) fd.dispatch = orig; // Clean Restoration
                else state.dead = true; // Another side is wrapped around us — we remain passive and do not break its chain
            } catch { /* ignore */ }
        };
    } catch { activeUnwrap = null; }
}

function unwrapDispatch() {
    if (!activeUnwrap) return;
    activeUnwrap();
    activeUnwrap = null;
    crumbs.length = 0;
}

// Listeners can redraw the button (to update its color/tip when switching states)
const buttonListeners = new Set<() => void>();
function notifyButton() {
    buttonListeners.forEach(l => l());
}

function clampMax(v: unknown): number {
    const n = typeof v === "number" ? v : parseInt(String(v), 10);
    return Number.isFinite(n) ? Math.min(5000, Math.max(50, Math.floor(n))) : 500;
}

function capture(type: ConsoleEventType, args: unknown[], detail?: string) {
    if (capturing) return; // We never re-enter the capture
    capturing = true;
    try {
        if (type === "log" && !settings.store.includeLog) return;
        if (type === "trace" && !settings.store.includeTrace) return;
        const cleaned = cleanConsoleArgs(args); // Remove %c noise and CSS styles
        // The stack caught the error if an Error object was passed within the arguments (this helps with diagnosis).
        let stack = detail;
        if (!stack) {
            const err = cleaned.find(a => a instanceof Error) as Error | undefined;
            if (err?.stack) stack = err.stack;
        }
        if (stack) stack = redactSecrets(stack); // The stack may contain links to tokens
        const serialized = cleaned.map(safeSerializeArg);
        const { source, pluginName } = detectSource(serialized); // Attribute the event to its source.

        const ev: ConsoleEvent = { timestamp: Date.now(), type, args: serialized, detail: stack, source, pluginName };

        if (ERROR_TYPES.has(type)) {
            // Inferential ratio for unlabeled errors + Flux crumbs (for errors only — cheap)
            if (!pluginName && source === "unknown")
                ev.probablePlugin = attributeProbablePlugin(serialized.join(" "), stack);
            if (crumbs.length) ev.crumbs = crumbs.slice(-6);
            errorCount++;
            notifyButton(); // Update the live button counter
        }

        events.push(ev);
        const max = clampMax(settings.store.maxEvents);
        while (events.length > max) events.shift(); // Delete the oldest one when the limit is exceeded.
    } catch {
        // The capture shouldn't be an exception to the Discord console — we swallow it silently.
    } finally {
        capturing = false; // This is implemented even with the above return.
    }
}

function hookConsole() {
    if (hooked) return;
    for (const m of HOOKED_METHODS) {
        if (!original[m]) original[m] = (console as any)[m]?.bind(console); // Save the original once
        const orig = original[m];
        (console as any)[m] = (...args: any[]) => {
           // Original first: keep the console working normally even if capturing fails
            try { orig?.(...args); } catch { /* The original threw — not our problem */ }
            capture(m, args);
        };
    }
    hooked = true;
}

function unhookConsole() {
    if (!hooked) return;
    for (const m of HOOKED_METHODS)
        if (original[m]) (console as any)[m] = original[m]; // Clean Restoration
    hooked = false;
}

// Named references to make removeEventListener work — and don't overwhelm the Discord wizard (additional)
function onWindowError(e: ErrorEvent) {
    capture("window.onerror", [e.message], e.error?.stack ?? `${e.filename}:${e.lineno}:${e.colno}`);
}
function onUnhandledRejection(e: PromiseRejectionEvent) {
    const r = e.reason;
    capture(
        "unhandledrejection",
        [r instanceof Error ? r.message : r],
        r instanceof Error ? r.stack : undefined
    );
}

function startRecording() {
    if (recording) return;
    events.length = 0; // Erase any previous data
    errorCount = 0;
    // Index of the inferential ratio: Names of extensions currently enabled (built once here)
    try { buildAttributionIndex(Object.keys(Plugins).filter(isPluginEnabled)); } catch { /* No index — only the labeled percentage remains */ }
    hookConsole();
    wrapDispatch(); // Flux crumbs — during registration only
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    recording = true;
    notifyButton();
}

// Unlocks everything without opening a window — used when the add-on is disabled
function teardownRecording() {
    unhookConsole();
    unwrapDispatch();
    clearAttributionIndex();
    window.removeEventListener("error", onWindowError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
    recording = false;
    notifyButton();
}

function stopRecording() {
    if (!recording) return;
    const snapshot = events.slice(); // A still image of the window
    teardownRecording();
    openEventsModal(snapshot);
}

const ERROR_TYPES = new Set<ConsoleEventType>(["error", "window.onerror", "unhandledrejection"]);

// Known browser noise that is harmless — we exclude it from “errors only”
function isNoise(e: ConsoleEvent): boolean {
    return e.args.some(a => a.includes("ResizeObserver loop"));
}

function formatEvents(list: ConsoleEvent[]): string {
    return list
        .map(e => {
            const ts = new Date(e.timestamp).toISOString().slice(11, 23); // HH:MM:SS.mmm
            const src = e.source !== "unknown"
                ? ` (${e.pluginName ?? e.source})`
                : (e.probablePlugin ? ` (${e.probablePlugin}?)` : ""); // "?" = inferred, not confirmed
            const head = `[${ts}] [${e.type}]${src} ${e.args.join(" ")}`;
            const lines = [head];
            if (e.crumbs?.length) lines.push(`    ↳ flux: ${e.crumbs.join(" → ")}`); // Immediately before the error
            if (e.detail) lines.push(`    ${e.detail}`);
            return lines.join("\n");
        })
        .join("\n");
}

// Text table of groups (to copy/download from the "Collector" view)
function formatGroups(groups: ErrorGroup[]): string {
    if (!groups.length) return "No errors.";
    return groups
        .map(g => {
            const span = Math.max(1, Math.round((g.lastAt - g.firstAt) / 1000));
            const who = g.pluginName ? ` [${g.pluginName}]` : ` [${g.source}]`;
            const storm = g.storm ? "  🌩STORM" : "";
            return `×${g.count}${storm}${who} (${g.type}, ${span}s) ${g.sample}`;
        })
        .join("\n");
}

// Automatic context header — reduces diagnostic questions (version/build/system + error counts by source
// + most frequent groups and any detected storms)
function buildReportHeader(list: ConsoleEvent[], groups: ErrorGroup[]): string {
    const errs = list.filter(e => ERROR_TYPES.has(e.type) && !isNoise(e));
    const bySrc = (s: string) => errs.filter(e => e.source === s).length;
    const warnings = list.filter(e => e.type === "warn").length;
    let build = "?";
    try {
        const b = getBuildNumber();
        if (b && b !== -1) build = String(b);
    } catch { /* Unavailable — ignore */ }
    const lines = [
        "=== ConsoleWatcher report ===",
        `Time:          ${new Date().toISOString()}`,
        `Equicord:      v${VERSION} (${gitHashShort})`,
        `Discord build: ${build}`,
        `Client:        ${navigator.userAgent}`,
        `Events:        total=${list.length}  warnings=${warnings}`,
        `Errors:        total=${errs.length}  (discord=${bySrc("discord")}, plugins=${bySrc("plugin")}, arabicizer=${bySrc("arabicizer")}, unknown=${bySrc("unknown")})`,
    ];
    const storms = groups.filter(g => g.storm);
    if (storms.length)
        lines.push(`Storms:        ${storms.length}  (${storms.map(g => `×${g.count} ${g.sample.slice(0, 40)}`).join(" | ")})`);
    for (const g of groups.slice(0, 3))
        lines.push(`Top error:     ×${g.count}${g.pluginName ? ` [${g.pluginName}]` : ""} ${g.sample.slice(0, 90)}`);
    lines.push("=============================");
    return lines.join("\n");
}

// Source filter tabs — isolate errors from a specific source before sharing diagnostics
type FilterId = "all" | "errors" | "grouped" | "discord" | "plugins" | "arabicizer";
const FILTERS: { id: FilterId; label: string; }[] = [
    { id: "all", label: "All" },
    { id: "errors", label: "Errors" },
    { id: "grouped", label: "Grouped" },
    { id: "discord", label: "Discord" },
    { id: "plugins", label: "Plugins" },
    { id: "arabicizer", label: "Arabicizer" }
];

function matchesFilter(e: ConsoleEvent, f: FilterId): boolean {
    switch (f) {
        case "errors": return ERROR_TYPES.has(e.type) && !isNoise(e);
        case "grouped": return ERROR_TYPES.has(e.type) && !isNoise(e); // Same error set, different view
        case "discord": return e.source === "discord";
        case "plugins": return e.source === "plugin";
        case "arabicizer": return e.source === "arabicizer";
        default: return true; // "all"
    }
}

function EventsModal({ modalProps, snapshot }: { modalProps: RenderModalProps; snapshot: ConsoleEvent[]; }) {
    const [filter, setFilter] = useState<FilterId>("all");
   // Groups are counted once per shot (shot is still after pause)
    const [groups] = useState<ErrorGroup[]>(() => groupErrors(snapshot, ERROR_TYPES, isNoise));
    const header = buildReportHeader(snapshot, groups);
    const filtered = snapshot.filter(e => matchesFilter(e, filter));
    const body = filter === "grouped"
        ? formatGroups(groups)
        : (filtered.length ? formatEvents(filtered) : "No matching events.");
    const text = `${header}\n\n${body}`;
    const shownCount = filter === "grouped" ? groups.length : filtered.length;

    function exportJson() {
        const payload = {
            _guncord: "consolewatcher",
            version: 2,
            takenAt: new Date().toISOString(),
            equicord: `v${VERSION} (${gitHashShort})`,
            events: snapshot,
            groups,
        };
        const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
        saveFile(new File([JSON.stringify(payload, null, 2)], `consolewatcher-${date}.json`, { type: "application/json" }));
    }

    return (
        <Modal
            {...modalProps}
            size="lg"
            title={`Console log (${snapshot.length} events)`}
        >
            <div className="cw-filters">
                {FILTERS.map(f => (
                    <button
                        key={f.id}
                        className={filter === f.id ? "cw-chip cw-chip-active" : "cw-chip"}
                        onClick={() => setFilter(f.id)}
                    >
                        {f.label} ({f.id === "grouped" ? groups.length : snapshot.filter(e => matchesFilter(e, f.id)).length})
                    </button>
                ))}
            </div>
            <div className="cw-body">
                <pre className="cw-pre">{text}</pre>
            </div>
            <div className="cw-footer">
                <Button onClick={() => copyWithToast(text, "✓ Copied shown")}>
                    {`Copy shown (${shownCount})`}
                </Button>
                <Button
                    color={Button.Colors.PRIMARY}
                    onClick={() => {
                        const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
                        saveFile(new File([text], `consolewatcher-${filter}-${date}.log`, { type: "text/plain" }));
                    }}
                >
                    {"Download as file"}
                </Button>
                <Button color={Button.Colors.PRIMARY} onClick={exportJson}>
                    {"Export JSON"}
                </Button>
            </div>
        </Modal>
    );
}

function openEventsModal(snapshot: ConsoleEvent[]) {
    openModal(props => (
        <ErrorBoundary>
            <EventsModal modalProps={props} snapshot={snapshot} />
        </ErrorBoundary>
    ));
}

// The eye/recording point icon — its color is `currentColor`, so it turns red via `.cw-recording` in CSS.
function RecordIcon({ width = 18, height = 18, color = "currentColor" }: { width?: number; height?: number; color?: string; size?: string; }) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="none">
            <path d="M12 5C6.5 5 3 9.5 3 12s3.5 7 9 7 9-4.5 9-7-3.5-7-9-7Z" stroke={color} strokeWidth="2" />
            <circle cx="12" cy="12" r="3.25" fill={color} />
        </svg>
    );
}

function ConsoleWatcherButton() {
    const [, force] = useState(0);
    useEffect(() => {
        const l = () => force(n => n + 1);
        buttonListeners.add(l);
        return () => void buttonListeners.delete(l);
    }, []);

    return (
        <HeaderBarButton
            icon={RecordIcon}
            tooltip={recording
                ? (errorCount > 0
                    ? `Stop recording — ${errorCount} errors so far`
                    : "Stop recording & show log")
            : "Start console recording"}
            className={recording ? (errorCount > 0 ? "cw-button cw-recording cw-has-errors" : "cw-button cw-recording") : "cw-button"}
            selected={recording}
            aria-label={"Console Watcher"}
            onClick={() => (recording ? stopRecording() : startRecording())}
        />
    );
}

export default definePlugin({
    name: "ConsoleWatcher",
    description: "Developer tool: records console events & errors only while recording — groups repeats, detects error storms, attributes errors to their source with Flux context, auto-redacts tokens — then shows everything for copying and export.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    dependencies: ["HeaderBarAPI"],
    settings,

    start() {
        addHeaderBarButton(BUTTON_ID, () => <ConsoleWatcherButton />);
    },

    stop() {
        if (recording) teardownRecording(); // We do not open a window when the add-on is disabled.
        events.length = 0;
        errorCount = 0;
        removeHeaderBarButton(BUTTON_ID);
    }
});
