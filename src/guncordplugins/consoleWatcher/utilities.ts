/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { ConsoleEvent, ConsoleEventType, ConsoleSource, ErrorGroup } from "./types";

const MAX_DEPTH = 4;
const MAX_STRING_LEN = 10_000;
const MAX_ARRAY_ITEMS = 100;
const MAX_OBJECT_KEYS = 100;

function describeSpecial(value: unknown): string | undefined {
    if (typeof value === "function")
        return `[Function${(value as Function).name ? ": " + (value as Function).name : ""}]`;
    if (typeof value === "symbol") return value.toString();
    if (typeof value === "bigint") return `${value}n`;
    if (value instanceof Error) return `[${value.name}: ${value.message}]`;
    if (typeof Node !== "undefined" && value instanceof Node) {
        const el = value as any;
        const tag = el.tagName?.toLowerCase?.() ?? el.nodeName?.toLowerCase?.() ?? "node";
        return `[HTMLElement <${tag}>]`;
    }
    return undefined;
}

function toSafe(value: unknown, depth: number, seen: WeakSet<object>): unknown {
    if (value === null) return null;

    const t = typeof value;
    if (t === "string") {
        const s = value as string;
        return s.length > MAX_STRING_LEN ? s.slice(0, MAX_STRING_LEN) + "…(truncated)" : s;
    }
    if (t === "number" || t === "boolean") return value;
    if (t === "undefined") return "undefined";

    const special = describeSpecial(value);
    if (special !== undefined) return special;

    if (depth >= MAX_DEPTH) return Array.isArray(value) ? "[Array]" : "[Object]";

    const obj = value as object;
    if (seen.has(obj)) return "[Circular]";
    seen.add(obj);
    try {
        if (Array.isArray(value)) {
            const out: unknown[] = [];
            const len = Math.min(value.length, MAX_ARRAY_ITEMS);
            for (let i = 0; i < len; i++) out.push(toSafe(value[i], depth + 1, seen));
            if (value.length > MAX_ARRAY_ITEMS) out.push(`…(+${value.length - MAX_ARRAY_ITEMS} more)`);
            return out;
        }

        const out: Record<string, unknown> = {};
        const keys = Object.keys(obj);
        const shown = Math.min(keys.length, MAX_OBJECT_KEYS);
        for (let i = 0; i < shown; i++) {
            const k = keys[i];
            try {
                out[k] = toSafe((obj as any)[k], depth + 1, seen);
            } catch {
                out[k] = "[Unserializable]";
            }
        }
        if (keys.length > MAX_OBJECT_KEYS) out["…"] = `(+${keys.length - MAX_OBJECT_KEYS} more)`;
        return out;
    } finally {
        seen.delete(obj);
    }
}

const SECRET_PATTERNS: [RegExp, string][] = [
    [/[\w-]{23,28}\.[\w-]{6,7}\.[\w-]{25,110}/g, "[REDACTED:token]"],
    [/mfa\.[\w-]{20,}/g, "[REDACTED:mfa-token]"],
    [/Bearer\s+[\w.~+/-]{15,}/g, "Bearer [REDACTED]"],
    [/[\w.+-]+@[\w-]+\.[a-zA-Z]{2,}/g, "[REDACTED:email]"],
];

export function redactSecrets(s: string): string {
    let out = s;
    for (const [re, sub] of SECRET_PATTERNS) out = out.replace(re, sub);
    return out;
}

export function safeSerializeArg(value: unknown): string {
    if (typeof value === "string")
        return redactSecrets(value.length > MAX_STRING_LEN ? value.slice(0, MAX_STRING_LEN) + "…(truncated)" : value);
    try {
        const safe = toSafe(value, 0, new WeakSet<object>());
        if (typeof safe === "string") return redactSecrets(safe);
        const json = JSON.stringify(safe);
        return redactSecrets(json.length > MAX_STRING_LEN ? json.slice(0, MAX_STRING_LEN) + "…(truncated)" : json);
    } catch {
        return "[Unserializable]";
    }
}

export function cleanConsoleArgs(args: unknown[]): unknown[] {
    const first = args[0];
    if (typeof first !== "string" || !first.includes("%c")) return args;

    const cssCount = (first.match(/%c/g) ?? []).length;
    const cleanedFirst = first.replace(/%c/g, "").trim();
    const rest = args.slice(1 + cssCount);
    return cleanedFirst ? [cleanedFirst, ...rest] : rest;
}

export function detectSource(args: string[]): { source: ConsoleSource; pluginName?: string; } {
    if (args.some(a => a.includes("[DiscordArabicizer]")))
        return { source: "arabicizer", pluginName: "DiscordArabicizer" };

    const head = (args[0] ?? "").trim();

    const eq = head.match(/^Equicord\s+(\S+)/);
    if (eq) return { source: "plugin", pluginName: eq[1] };

    if (/^\[[^\]]+\]/.test(head)) return { source: "discord" };

    return { source: "unknown" };
}

let attributionNames: { name: string; re: RegExp; }[] = [];

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildAttributionIndex(enabledNames: string[]): void {
    attributionNames = enabledNames
        .filter(n => n.length >= 5)
        .sort((a, b) => b.length - a.length)
        .map(name => ({ name, re: new RegExp(`(?:^|[^A-Za-z0-9])${escapeRe(name)}(?:[^A-Za-z0-9]|$)`, "i") }));
}

export function clearAttributionIndex(): void {
    attributionNames = [];
}

export function attributeProbablePlugin(text: string, stack?: string): string | undefined {
    if (attributionNames.length === 0) return undefined;
    const hay = stack ? `${text}\n${stack}` : text;
    for (const { name, re } of attributionNames)
        if (re.test(hay)) return name;
    return undefined;
}

export function normalizeGroupKey(text: string): string {
    return text
        .replace(/https?:\/\/\S+/g, "<url>")
        .replace(/[a-f0-9]{16,}/gi, "<id>")
        .replace(/\d{5,}/g, "<id>")
        .replace(/\d+/g, "#")
        .slice(0, 140);
}

const STORM_COUNT = 20;
const STORM_WINDOW_MS = 60_000;

export function groupErrors(list: ConsoleEvent[], errorTypes: ReadonlySet<ConsoleEventType>, isNoise: (e: ConsoleEvent) => boolean): ErrorGroup[] {
    const groups = new Map<string, ErrorGroup>();
    for (const e of list) {
        if (!errorTypes.has(e.type) || isNoise(e)) continue;
        const text = e.args.join(" ");
        const key = `${e.type}|${normalizeGroupKey(text)}`;
        const g = groups.get(key);
        if (g) {
            g.count++;
            if (e.timestamp < g.firstAt) g.firstAt = e.timestamp;
            if (e.timestamp > g.lastAt) g.lastAt = e.timestamp;
            if (!g.pluginName && (e.pluginName ?? e.probablePlugin)) g.pluginName = e.pluginName ?? e.probablePlugin;
        } else {
            groups.set(key, {
                key,
                sample: text.slice(0, 200),
                type: e.type,
                source: e.source,
                pluginName: e.pluginName ?? e.probablePlugin,
                count: 1,
                firstAt: e.timestamp,
                lastAt: e.timestamp,
                storm: false,
            });
        }
    }
    const out = [...groups.values()];
    for (const g of out)
        g.storm = g.count >= STORM_COUNT && (g.lastAt - g.firstAt) <= STORM_WINDOW_MS;
    return out.sort((a, b) => b.count - a.count);
}
