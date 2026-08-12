/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, IpcMainInvokeEvent } from "electron";

export interface ProcMetric {
    type: string;
    pid: number;
    cpu: number | null;
    memMB: number;
}

const lastCpu = new Map<string, { cumSec: number; atMs: number; }>();

const MAX_GAP_MS = 10_000;

export async function getAppMetrics(_e: IpcMainInvokeEvent): Promise<ProcMetric[]> {
    try {
        const nowMs = Date.now();
        const seen = new Set<string>();

        const out = app.getAppMetrics().map(m => {
            const key = `${m.pid}:${m.creationTime}`;
            seen.add(key);

            const cumSec = m.cpu?.cumulativeCPUUsage;
            let cpu: number | null = null;

            if (typeof cumSec === "number" && Number.isFinite(cumSec)) {
                const prev = lastCpu.get(key);
                lastCpu.set(key, { cumSec, atMs: nowMs });

                if (prev != null) {
                    const wallMs = nowMs - prev.atMs;
                    const usedSec = cumSec - prev.cumSec;
                    if (wallMs > 0 && wallMs <= MAX_GAP_MS && usedSec >= 0) {
                        const pct = (usedSec / (wallMs / 1000)) * 100;
                        cpu = Math.round(pct * 10) / 10;
                    }
                }
            }

            return {
                type: m.type,
                pid: m.pid,
                cpu,
                memMB: Math.round((m.memory?.workingSetSize ?? 0) / 1024),
            };
        });

        for (const key of lastCpu.keys()) if (!seen.has(key)) lastCpu.delete(key);

        return out;
    } catch {
        return [];
    }
}
