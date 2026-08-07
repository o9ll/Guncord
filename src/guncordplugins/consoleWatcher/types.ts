/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export type ConsoleEventType =
    | "log" | "warn" | "error" | "info" | "debug" | "trace"
    | "table" | "group" | "groupCollapsed" | "groupEnd"
    | "time" | "timeEnd" | "clear"
    | "window.onerror" | "unhandledrejection";

/**
 * Event source detected from its tag:
 * - `arabicizer`: DiscordArabicizer logs ([DiscordArabicizer] tag).
 * - `plugin`: Vencord/Equicord plugin via Logger ("Equicord <Name>" prefix).
 * - `discord`: Core Discord module (log tagged with [Module]).
 * - `unknown`: No identifiable tag (such as raw window.onerror errors).
 */
export type ConsoleSource = "arabicizer" | "plugin" | "discord" | "unknown";

export interface ConsoleEvent {
    /** Event timestamp (Date.now()) */
    timestamp: number;
    /** Event type */
    type: ConsoleEventType;
    /** Arguments serialized to text immediately — never live references (prevents memory leaks) */
    args: string[];
    /** Optional extra context (such as an error stack) */
    detail?: string;
    /** Detected event source (for filtering by plugin/Discord/project) */
    source: ConsoleSource;
    /** Plugin name if extracted from the tag */
    pluginName?: string;
    /**
     * Heuristic match (not an explicit tag): an enabled plugin name appeared in the
     * error text or stack. Displayed with a "?" — possible, not certain.
     */
    probablePlugin?: string;
    /** Flux breadcrumbs: event types dispatched immediately before this error (diagnostic context) */
    crumbs?: string[];
}

/** Group of identical errors (after normalizing numbers/identifiers) — calculated only when generating a report. */
export interface ErrorGroup {
    /** Normalized key (numbers/identifiers/URLs → fixed placeholders) */
    key: string;
    /** Text from the first occurrence (as originally shown) */
    sample: string;
    type: ConsoleEventType;
    source: ConsoleSource;
    pluginName?: string;
    count: number;
    firstAt: number;
    lastAt: number;
    /** Storm: high-frequency repeats (≥20 events within ≤60 seconds) — indicates a loop or handler leak */
    storm: boolean;
}
