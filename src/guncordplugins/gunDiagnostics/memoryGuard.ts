/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const SAMPLE_MS = 60_000;
const WINDOW = 15;
const GROWTH_MB = 150;

let timer: ReturnType<typeof setInterval> | null = null;
let samples: number[] = [];
let notified = false;

function heapMB(): number | null {
    try {
        const used = (performance as { memory?: { usedJSHeapSize?: number; }; }).memory?.usedJSHeapSize;
        return typeof used === "number" ? used / 1048576 : null;
    } catch { return null; }
}

function baselineGrowth(): number | null {
    if (samples.length < WINDOW) return null;
    const half = Math.floor(WINDOW / 2);
    const oldBase = Math.min(...samples.slice(0, half));
    const newBase = Math.min(...samples.slice(-half));
    return newBase - oldBase;
}

export function startMemoryGuard(onLeak: (growthMB: number) => void): void {
    if (timer !== null) return; // idempotent
    samples = [];
    notified = false;
    timer = setInterval(() => {
        try {
            const mb = heapMB();
            if (mb === null) return;
            samples.push(mb);
            if (samples.length > WINDOW) samples.shift();
            const growth = baselineGrowth();
            if (growth !== null && growth >= GROWTH_MB && !notified) {
                notified = true;
                onLeak(Math.round(growth));
            }
        } catch { /* The guard must never harm anyone */ }
    }, SAMPLE_MS);
}

export function stopMemoryGuard(): void {
    if (timer !== null) { clearInterval(timer); timer = null; }
    samples = [];
    notified = false;
}
