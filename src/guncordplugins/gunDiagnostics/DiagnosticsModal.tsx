/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

// ─── Layer 3: UI (render ONLY — no scanning, no scoring) ─────────────────────

import "./styles.css";

import { get as dsGet, set as dsSet } from "@api/DataStore";
import type { RenderModalProps } from "@vencord/discord-types";
import { saveFile } from "@utils/web";
import { Button, Modal, React, TextInput, Tooltip, useEffect, useState } from "@webpack/common";

import type { ImpactPhase, ImpactResult } from "./impactTest";
import { isImpactTestRunning, listImpactCandidates, runImpactTest } from "./impactTest";
import type { RuntimeReport } from "./runtimeProfiler";
import { runtimeProfiler } from "./runtimeProfiler";
import { sampleHeapMB } from "./scanner";
import type { ScoredPlugin, SnapshotSummary } from "./scoring";
import { summarize } from "./scoring";

type SortKey = "name" | "type" | "hooks" | "listeners" | "patches" | "pendingPatches" | "uiInjects" | "risk";

const BASELINE_KEY = "GunDiagnostics_baseline";
interface Baseline {
    takenAt: string;
    risks: Record<string, number>;
}

function makeBaseline(rows: ScoredPlugin[]): Baseline {
    const risks: Record<string, number> = {};
    for (const r of rows) risks[r.name] = r.risk;
    return { takenAt: new Date().toISOString(), risks };
}

// The file is meant to be read later, away from this UI, so it carries its own
// context: what the numbers mean and whether a profile was actually recorded.
// A bare list of scores is not reviewable six weeks from now.
function exportJson(rows: ScoredPlugin[], runtime: RuntimeReport | null, summary: SnapshotSummary) {
    // Sampled HERE, not taken from the modal's open-time prop: the readme promises
    // "at export time", and a stale prop made that a lie — one export read 413 MB
    // beside runtime.heap.currentMB of 322 with no way to tell why (the heap sawtooths
    // ±100 MB within a second, so both were true, minutes apart).
    const heapMB = sampleHeapMB();
    const payload = {
        _gun: "diagnostics",
        version: 4,
        takenAt: new Date().toISOString(),
        readme: {
            risk: "Static load score per plugin (higher = heavier). Derived from hooks/listeners/patches/uiInjects — it is NOT measured CPU.",
            runtime: runtime
                ? "Live measurements from a profiling recording: heap samples, event-loop lag (avg/max/p95) and the heaviest Flux dispatch types."
                : "null — no profiling recording was running when this was exported. Press 'Record Profile', use Discord normally for a minute, then export again for live CPU/RAM numbers.",
            heapMB: "Renderer JS heap sampled at export time, in MB. Expect it to differ from runtime.heap.currentMB (the last sample of the recording) — GC makes the heap sawtooth by ~100 MB within a second, so both are true at different instants.",
            cpu: "Percent per process, derived from deltas of Electron's cumulativeCPUUsage counter. 100% = one core fully busy, so a process may exceed 100% across cores. null = unreadable (never a fabricated 0); the first sample of a recording is always null as there is no previous one to subtract.",
            durationSec: "Measured span of the recording. Freezes when you press Stop, so exporting later does not inflate it.",
        },
        summary,
        heapMB,
        runtime,
        plugins: rows,
    };
    const date = new Date().toISOString().slice(0, 10);
    saveFile(new File([JSON.stringify(payload, null, 2)], `gun-diagnostics-${date}.json`, { type: "application/json" }));
}

// A control whose label cannot carry its own meaning ("Save baseline" tells you
// nothing about what it buys you) gets a native tooltip saying what it does and why.
function HintButton({ hint, children, ...props }: React.ComponentProps<typeof Button> & { hint: string; }) {
    return (
        <Tooltip text={hint}>
            {tooltipProps => <Button {...tooltipProps} {...props}>{children}</Button>}
        </Tooltip>
    );
}

function Sparkline({ series }: { series: number[]; }) {
    if (series.length < 2) return null;
    const w = 150, h = 30;
    const min = Math.min(...series), max = Math.max(...series);
    const span = Math.max(max - min, 1);
    const pts = series
        .map((v, i) => `${(i / (series.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`)
        .join(" ");
    return (
        <svg className="gun-diag-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
            <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
    );
}

function procLabel(type: string): string {
    switch (type) {
        case "Browser": return "Main";
        case "Tab": return "Renderer";
        case "GPU": return "GPU";
        case "Utility": return "Utility";
        default: return type;
    }
}

function RuntimePanel({ report }: { report: RuntimeReport; }) {
    const cell = (label: string, value: React.ReactNode, warn = false) => (
        <div className="gun-diag-metric">
            <div className="gun-diag-metric-label">{label}</div>
            <div className="gun-diag-metric-value" style={warn ? { color: "#ed4245" } : undefined}>{value}</div>
        </div>
    );
    return (
        <div className="gun-diag-runtime">
            <div className="gun-diag-metrics">
                {cell("CPU now", report.cpu.available ? `${report.cpu.totalNow}%` : "n/a")}
                {cell("CPU peak", report.cpu.available ? `${report.cpu.peakTotal}%` : "—")}
                {cell("JS heap", report.heap.currentMB != null ? `${report.heap.currentMB} MB` : "—")}
                {cell("Mem growth", `${report.heap.growthMBPerMin} MB/${"min"}`, report.heap.leakSuspected)}
                {cell("FPS", report.fps.now > 0 ? `${report.fps.now}${report.fps.min != null ? ` (${"min"} ${report.fps.min})` : ""}` : "—", report.fps.min != null && report.fps.min < 30)}
                {cell("Lag avg", `${report.eventLoop.avgLagMs} ms`)}
                {cell("p95", `${report.eventLoop.p95LagMs} ms`, report.eventLoop.p95LagMs > 50)}
                {cell("Lag max", `${report.eventLoop.maxLagMs} ms`, report.eventLoop.maxLagMs > 100)}
                {cell("Blocking", `${report.longtasks.count}× / ${report.longtasks.totalBlockingMs}ms`, report.longtasks.totalBlockingMs > 500)}
                {cell("Duration", `${report.durationSec}s`)}
            </div>
            {report.heap.series.length > 1 && (
                <div className="gun-diag-sparkrow">
                    <span className="gun-diag-fn-title">{"Heap trend (last minute)"}</span>
                    <Sparkline series={report.heap.series} />
                    <span className="gun-diag-sparkminmax">
                        {report.heap.minMB}–{report.heap.maxMB} MB
                    </span>
                </div>
            )}
            {report.heap.leakSuspected && (
                <div className="gun-diag-leak">{"⚠️ Leak suspected: heap baseline is rising steadily"}</div>
            )}
            {/* Blocking is what a user actually feels. Knowing it happened is useless
                without knowing who did it, so name the culprits. */}
            {report.longtasks.blame.length > 0 && (
                <>
                    <div className="gun-diag-fn-title">
                        {"What blocked the main thread (blamed on the dispatch it overlapped)"}
                    </div>
                    <table className="gun-diag-table">
                        <thead>
                            <tr>
                                <th>{"Event"}</th>
                                <th className="num">{"Tasks"}</th>
                                <th className="num">{"Blocked (ms)"}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.longtasks.blame.map(b => (
                                <tr key={b.type} className="gun-diag-row">
                                    <td>{b.type === "(unattributed)"
                                        ? "(unattributed — not a Flux dispatch: React render or GC)"
                                        : b.type}</td>
                                    <td className="num">{b.count}</td>
                                    <td className="num">{b.totalMs}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
            {report.cpu.perProcess.length > 0 && (
                <>
                    <div className="gun-diag-fn-title">{"Discord processes (real system metrics)"}</div>
                    <table className="gun-diag-table">
                        <thead>
                            <tr>
                                <th>{"Process"}</th>
                                <th className="num">PID</th>
                                <th className="num">CPU%</th>
                                <th className="num">RAM MB</th>
                            </tr>
                        </thead>
                        <tbody>
                            {/* RAM is readable even when CPU is not, so sort by memory and
                                print "؟" for an unreadable CPU rather than a fake 0. */}
                            {[...report.cpu.perProcess].sort((a, b) => b.memMB - a.memMB).map(p => (
                                <tr key={p.pid} className="gun-diag-row">
                                    <td>{procLabel(p.type)}</td>
                                    <td className="num">{p.pid}</td>
                                    <td className="num">{p.cpu != null ? p.cpu : "?"}</td>
                                    <td className="num">{p.memMB}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
            {report.topDispatch.length > 0 && (
                <>
                    <div className="gun-diag-fn-title">{"Heaviest Flux events (sync execution time)"}</div>
                    <table className="gun-diag-table">
                        <thead>
                            <tr>
                                <th>{"Event"}</th>
                                <th className="num">{"count"}</th>
                                <th className="num">{"avg ms"}</th>
                                <th className="num">{"max ms"}</th>
                                <th className="num">{"total ms"}</th>
                                <th className="num">{"subs"}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.topDispatch.map(d => (
                                <tr key={d.type} className="gun-diag-row">
                                    <td>{d.type}</td>
                                    <td className="num">{d.count}</td>
                                    <td className="num">{d.avgMs}</td>
                                    <td className="num">{d.maxMs}</td>
                                    <td className="num">{d.totalMs}</td>
                                    <td className="num">{d.subscribers ?? "؟"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
            <div className="gun-diag-fn-title">{"Top functions (measured)"}</div>
            {report.topFunctions.length === 0 ? (
                <div className="gun-diag-empty">{"No samples yet — interact with the UI while recording"}</div>
            ) : (
                <table className="gun-diag-table">
                    <thead>
                        <tr>
                            <th>{"Function"}</th>
                            <th className="num">{"calls/s"}</th>
                            <th className="num">{"avg ms"}</th>
                            <th className="num">{"max ms"}</th>
                            <th className="num">{"total ms"}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {report.topFunctions.map(f => (
                            <tr key={f.name} className="gun-diag-row">
                                <td>{f.name}</td>
                                <td className="num">{f.callsPerSec}</td>
                                <td className="num">{f.avgMs}</td>
                                <td className="num">{f.maxMs}</td>
                                <td className="num">{f.totalMs}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

function phaseLabel(ph: ImpactPhase): string {
    switch (ph) {
        case "measuring-on": return "Measuring with plugin ON…";
        case "stopping": return "Temporarily stopping plugin…";
        case "measuring-off": return "Measuring with plugin OFF…";
        case "restoring": return "Restarting plugin…";
    }
}

const PHASE_SEC = 8;

function ImpactPanel() {
    const [{ eligible, excluded }] = useState(listImpactCandidates);
    const [target, setTarget] = useState("");
    const [phase, setPhase] = useState<ImpactPhase | null>(null);
    const [result, setResult] = useState<ImpactResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    async function run() {
        if (!target || isImpactTestRunning()) return;
        setResult(null);
        setError(null);
        try {
            const r = await runImpactTest(target, PHASE_SEC, setPhase);
            setResult(r);
        } catch (e) {
            setError(String(e instanceof Error ? e.message : e));
        } finally {
            setPhase(null);
        }
    }

    const verdictText = (v: ImpactResult["verdict"]) =>
        v === "high" ? "High impact — this plugin has a real cost on your machine"
            : v === "moderate" ? "Moderate impact"
                : "Negligible — within noise margin";

    return (
        <div className="gun-diag-impact">
            <div className="gun-diag-fn-title">
                {"Plugin impact test (real causal test — temporarily stops it, then restores)"}
            </div>
            <div className="gun-diag-impact-row">
                <select
                    className="gun-diag-select"
                    value={target}
                    onChange={e => setTarget(e.currentTarget.value)}
                    disabled={phase != null}
                >
                    <option value="">{"Pick a plugin…"}</option>
                    {eligible.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <HintButton
                    size={Button.Sizes.SMALL}
                    disabled={!target || phase != null}
                    onClick={run}
                    hint={
                        `Measures the plugin running, then temporarily stops it and measures again, so you get the difference it alone causes — not a guess. It is switched back on automatically after ${PHASE_SEC * 2 + 1}s. Leave Discord alone while it runs, or you contaminate the result.`
                    }
                >
                    {phase != null ? phaseLabel(phase) : `Measure (${PHASE_SEC * 2 + 1}s)`}
                </HintButton>
            </div>
            <div className="gun-diag-impact-note">
                {
                    `Eligible: ${eligible.length}. Not eligible: ${excluded.filter(x => x.reason === "patches").length} need a restart (patches can't be unloaded live), ${excluded.filter(x => x.reason === "dependants").length} have dependants.`
                }
            </div>
            {error && <div className="gun-diag-leak">⚠️ {error}</div>}
            {result && (
                <div className="gun-diag-impact-result">
                    <div className={`gun-diag-verdict v-${result.verdict}`}>{verdictText(result.verdict)}</div>
                    {result.restoreFailed && (
                        <div className="gun-diag-leak">
                            {"⚠️ Auto-restart failed — re-enable the plugin manually from settings NOW!"}
                        </div>
                    )}
                    <table className="gun-diag-table">
                        <thead>
                            <tr>
                                <th>{"Metric"}</th>
                                <th className="num">{"ON"}</th>
                                <th className="num">{"OFF"}</th>
                                <th className="num">Δ</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="gun-diag-row">
                                <td>{"Loop lag (avg ms)"}</td>
                                <td className="num">{result.on.lagAvgMs}</td>
                                <td className="num">{result.off.lagAvgMs}</td>
                                <td className="num">{result.lagImprovementMs > 0 ? `-${result.lagImprovementMs}` : `+${-result.lagImprovementMs}`}</td>
                            </tr>
                            <tr className="gun-diag-row">
                                <td>p95 (ms)</td>
                                <td className="num">{result.on.lagP95Ms}</td>
                                <td className="num">{result.off.lagP95Ms}</td>
                                <td className="num">{Math.round((result.on.lagP95Ms - result.off.lagP95Ms) * 100) / 100}</td>
                            </tr>
                            <tr className="gun-diag-row">
                                <td>{"Blocking/min (ms)"}</td>
                                <td className="num">{result.on.blockingMsPerMin}</td>
                                <td className="num">{result.off.blockingMsPerMin}</td>
                                <td className="num">{result.blockingDropMsPerMin}</td>
                            </tr>
                            <tr className="gun-diag-row">
                                <td>FPS</td>
                                <td className="num">{result.on.fpsAvg ?? "—"}</td>
                                <td className="num">{result.off.fpsAvg ?? "—"}</td>
                                <td className="num">{result.fpsGain != null ? (result.fpsGain >= 0 ? `+${result.fpsGain}` : result.fpsGain) : "—"}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div className="gun-diag-impact-note">
                        {"A single short sample can be noisy — repeat the test twice to confirm."}
                    </div>
                </div>
            )}
        </div>
    );
}

function buildRecommendations(rows: ScoredPlugin[], runtime: RuntimeReport | null): string[] {
    const out: string[] = [];
    const pendingTotal = rows.reduce((a, r) => a + r.pendingPatches, 0);
    const heavy = rows.filter(r => r.type === "continuous").slice(0, 3).map(r => `${r.name} (${r.risk})`);

    if (runtime) {
        if (runtime.heap.leakSuspected)
            out.push(
                `🔴 Sustained heap growth ${runtime.heap.growthMBPerMin}MB/min — run the impact test on the heaviest: ${heavy.join(", ")}`
            );
        if (runtime.eventLoop.p95LagMs > 50)
            out.push(
                `🟠 Event-loop p95 is ${runtime.eventLoop.p95LagMs}ms (>50) — the main thread is strained.`
            );
        if (runtime.longtasks.count > 0 && runtime.longtasks.maxMs > 200) {
            // Point at the culprit now that we can attribute the blocking.
            const top = runtime.longtasks.blame.find(b => b.type !== "(unattributed)");
            const who = top
                ? ` Mostly overlapping ${top.type} (${top.totalMs}ms).`
                : " None of them were Flux dispatches — most likely React rendering or GC.";
            out.push(
                `🟠 ${runtime.longtasks.count} long tasks (max ${runtime.longtasks.maxMs}ms) — perceptible UI stalls.${who}`
            );
        }
        const d0 = runtime.topDispatch[0];
        if (d0 && d0.totalMs > 500)
            out.push(
                `🟡 Heaviest Flux event: ${d0.type} — ${d0.totalMs}ms total (${d0.count}×${d0.subscribers != null ? `, ${d0.subscribers} subscribers` : ""}).`
            );
        if (runtime.fps.min != null && runtime.fps.min < 30)
            out.push(
                `🟠 Minimum recorded FPS is ${runtime.fps.min} — a perceptible smoothness drop while recording.`
            );
    }
    if (pendingTotal > 0) {
        // Naming the plugins makes this actionable: an unapplied patch means that
        // plugin is silently doing part of its job, and a bare total hides who.
        const worst = rows
            .filter(r => r.pendingPatches > 0)
            .sort((a, b) => b.pendingPatches - a.pendingPatches)
            .slice(0, 3)
            .map(r => `${r.name} (${r.pendingPatches})`);
        out.push(
            `🟡 ${pendingTotal} patches never applied — worst: ${worst.join(", ")}. A plugin with a pending patch is silently doing only part of its job. Usually a lazy module not loaded yet (clears once you use the feature), or a patch broken by a Discord update (needs fixing).`
        );
    }
    if (out.length === 0)
        out.push(runtime
            ? "✅ Nothing to flag — every measured indicator is within normal range."
            : "ℹ️ Start a profiling recording to get recommendations based on live measurements.");
    return out;
}

export function DiagnosticsModal({ modalProps, initial, heapMB, rescan, interval = 5 }: {
    modalProps: RenderModalProps;
    initial: ScoredPlugin[];
    heapMB: number | null;
    rescan: () => ScoredPlugin[];
    interval?: number;
}) {
    const [rows, setRows] = useState<ScoredPlugin[]>(initial);
    const [search, setSearch] = useState("");
    const [sortKey, setSortKey] = useState<SortKey>("risk");
    const [asc, setAsc] = useState(false);

    // ── Live monitoring ──
    const [live, setLive] = useState(false);
    // The prop is only a seed. It was sampled once when the modal opened, yet the
    // badge below calls itself "Current JS heap" — frozen minutes later it was simply
    // wrong. Refreshed on every re-scan and on each second of a recording.
    const [heapNow, setHeapNow] = useState<number | null>(heapMB);
    const [countdown, setCountdown] = useState(interval);
    const [resetNonce, setResetNonce] = useState(0); // bump → restart the timer (manual re-scan)

    // ── Runtime profiling (opt-in) — real CPU/RAM/function timing while recording ──
    // Seeded from the profiler, not from `false`: a recording outlives this modal,
    // so re-opening must show the run that is still going rather than claim idle.
    const [recording, setRecording] = useState(() => runtimeProfiler.recording);
    // Seeded from hasData, not from `recording`: the profiler keeps a finished run's
    // report, but this used to reseed to null unless a recording was live RIGHT NOW.
    // So record → Stop → close the modal → reopen → the numbers were gone and Export
    // wrote `runtime: null`, while getReport() still held the whole run.
    const [runtime, setRuntime] = useState<RuntimeReport | null>(() => runtimeProfiler.hasData ? runtimeProfiler.getReport() : null);

    const [baseline, setBaseline] = useState<Baseline | null>(null);
    useEffect(() => {
        let alive = true;
        dsGet<Baseline>(BASELINE_KEY).then(b => { if (alive && b) setBaseline(b); }).catch(() => { /* No basis yet */ });
        return () => { alive = false; };
    }, []);
    async function saveBaseline() {
        const b = makeBaseline(rows);
        try { await dsSet(BASELINE_KEY, b); setBaseline(b); } catch { /* Storage unavailable */ }
    }

    // The recording deliberately OUTLIVES this modal. You have to close the modal to
    // use Discord, and profiling an idle modal measures nothing — so unmount must not
    // stop it. Only the Stop button does (or the plugin being disabled, see index.tsx).
    // Cleanup therefore tears down the 1s UI poll and nothing else.
    useEffect(() => {
        if (!recording) return;
        runtimeProfiler.start(); // no-op if already running
        setRuntime(runtimeProfiler.getReport());
        const id = setInterval(() => {
            setRuntime(runtimeProfiler.getReport());
            setHeapNow(sampleHeapMB());
        }, 1000);
        return () => clearInterval(id);
    }, [recording]);

    function stopRecording() {
        runtimeProfiler.stop();
        setRecording(false);
        setRuntime(runtimeProfiler.getReport()); // keep the finished run on screen to read/export
    }

    // Manual re-scan: refresh now AND reset the live countdown (no double allocation,
    // the previous rows are released for GC once setRows replaces them).
    function doRescan() {
        setRows(rescan());
        setHeapNow(sampleHeapMB());
        setResetNonce(n => n + 1);
    }

    function startLive() {
        // auto-sort by load (desc) so the heaviest plugins surface immediately
        setSortKey("risk");
        setAsc(false);
        setLive(true);
    }

    // Single 1s ticking loop while live. `remaining` is a closure local (not state),
    // so updates are predictable. Cleanup clears the timer on stop / deps-change /
    // modal close (unmount) → no leak, zero cost when not monitoring.
    useEffect(() => {
        if (!live) {
            setCountdown(interval);
            return;
        }
        let remaining = interval;
        setCountdown(remaining);
        const id = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                setRows(rescan());
                setHeapNow(sampleHeapMB());
                remaining = interval;
            }
            setCountdown(remaining);
        }, 1000);
        return () => clearInterval(id);
    }, [live, interval, resetNonce, rescan]);

    // built per-render so language (t) is always current
    const columns: { key: SortKey; label: string; tip: string; num: boolean; }[] = [
        { key: "name", label: "Plugin", tip: "Plugin name", num: false },
        { key: "type", label: "Type", tip: "Runs continuously in the background vs. only on demand", num: false },
        { key: "hooks", label: "Hooks", tip: "Registered slash commands", num: true },
        { key: "listeners", label: "Listeners", tip: "Flux/Dispatcher subscriptions", num: true },
        { key: "patches", label: "Patches", tip: "Webpack code patches", num: true },
        { key: "pendingPatches", label: "Pending", tip: "Patches not applied yet (module never matched) — may be a lazy module not loaded yet, or a patch broken by a Discord update", num: true },
        { key: "uiInjects", label: "UI Injects", tip: "Context menus + UI render surfaces", num: true },
        // Says what it is AND what it is not. This score is blind to a plugin that
        // hooks intl instead of patching (DiscordArabicizer scores 0 while being the
        // busiest thing measured), so calling it "cost" would be a lie.
        {
            key: "risk", label: "Load", num: true,
            tip: "Structural surface area, NOT measured CPU: (patches×2)+(listeners×3)+(uiInjects×1.5). A high number means a wider surface to affect things, not confirmed slowness. For real cost use Record Profile or the plugin impact test.",
        },
    ];

    function sortBy(key: SortKey) {
        if (key === sortKey) setAsc(!asc);
        else { setSortKey(key); setAsc(key === "name" || key === "type"); }
    }

    const q = search.trim().toLowerCase();
    const view = rows
        .filter(r => !q || r.name.toLowerCase().includes(q))
        .sort((a, b) => {
            const av = a[sortKey], bv = b[sortKey];
            const cmp = typeof av === "string"
                ? (av as string).localeCompare(bv as string)
                : (av as number) - (bv as number);
            return asc ? cmp : -cmp;
        });

    const summary = summarize(rows);

    return (
        <Modal {...modalProps} size="lg" title={"Gun Diagnostics"}>
            <div className="gun-diag">
                <div className="gun-diag-sub">
                    {live
                        ? "Live monitoring active — auto-refreshing"
                        : "One-time plugin resource snapshot"}
                </div>

                <div className="gun-diag-toolbar">
                    <div className="gun-diag-searchwrap">
                        <TextInput
                            placeholder={"Search..."}
                            value={search}
                            onChange={setSearch}
                        />
                    </div>
                    <div className="gun-diag-actions">
                        {heapNow != null && (
                            <span className="gun-diag-heap" title={"Current JS heap"}>
                                Heap: {heapNow} MB
                            </span>
                        )}
                        {live && (
                            <span
                                className="gun-diag-heap"
                                style={{ color: "var(--text-positive, #3ba55c)" }}
                                title={"Auto-refresh is on"}
                            >
                                ⟳ {"Refresh in"} {countdown}{"s"}
                            </span>
                        )}
                        <HintButton
                            size={Button.Sizes.SMALL}
                            onClick={doRescan}
                            hint={
                                "Re-measures every plugin's footprint right now. A single instant snapshot — it leaves nothing running in the background."
                            }
                        >
                            {"Re-scan"}
                        </HintButton>
                        {live ? (
                            <HintButton
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.RED}
                                onClick={() => setLive(false)}
                                hint={"Stop re-scanning automatically."}
                            >
                                {"Stop Monitoring"}
                            </HintButton>
                        ) : (
                            <HintButton
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.GREEN}
                                onClick={startLive}
                                hint={
                                    `Re-scans automatically every ${interval}s while this window is open, so you watch the numbers move. Stops when the window closes.`
                                }
                            >
                                {"Start Live Monitoring"}
                            </HintButton>
                        )}
                        {recording ? (
                            <HintButton
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.RED}
                                onClick={stopRecording}
                                hint={
                                    "Stop recording and show the results. They stay on screen for you to read or export."
                                }
                            >
                                {"Stop Recording"}
                            </HintButton>
                        ) : (
                            <HintButton
                                size={Button.Sizes.SMALL}
                                color={Button.Colors.GREEN}
                                onClick={() => setRecording(true)}
                                hint={
                                    "Measures real CPU, memory and UI lag while you use Discord. How: press it, close this window, use Discord normally for a minute or two, then come back and stop it. Recording continues after the window closes — the icon up top stays red the whole time."
                                }
                            >
                                {"⏺ Record Profile"}
                            </HintButton>
                        )}
                        {/* `rows`, not `view`: exporting the search-filtered list silently
                            produced a partial report that still looked complete. */}
                        <HintButton
                            size={Button.Sizes.SMALL}
                            color={Button.Colors.PRIMARY}
                            onClick={() => exportJson(rows, runtime, summary)}
                            hint={
                                "Saves a file with every plugin and its numbers, plus the recorded measurements if a profile was running — to review later or share. Record a profile first to get live numbers in it."
                            }
                        >
                            {"Export JSON"}
                        </HintButton>
                        <HintButton
                            size={Button.Sizes.SMALL}
                            color={Button.Colors.PRIMARY}
                            onClick={saveBaseline}
                            hint={baseline
                                ? `Replaces the saved baseline (${new Date(baseline.takenAt).toLocaleDateString()}) with today's numbers, so comparisons start from now.`
                                : "Saves today's numbers as a reference point. From then on each plugin shows how much heavier ▲ or lighter ▼ it got against it — save one while performance feels good, so later you know exactly what slowed Discord down."
                                }
                        >
                            {"Save baseline"}
                        </HintButton>
                    </div>
                </div>

                {recording && runtime && <RuntimePanel report={runtime} />}

                <ImpactPanel />

                <div className="gun-diag-recs">
                    <div className="gun-diag-fn-title">{"Findings & recommendations (from real measurements)"}</div>
                    {buildRecommendations(rows, runtime).map((r, i) => (
                        <div key={i} className="gun-diag-rec">{r}</div>
                    ))}
                </div>

                <div className="gun-diag-tablewrap">
                    <table className="gun-diag-table">
                        <thead>
                            <tr>
                                {columns.map(c => (
                                    <th
                                        key={c.key}
                                        title={c.tip}
                                        className={c.num ? "num" : ""}
                                        onClick={() => sortBy(c.key)}
                                    >
                                        {c.label}{sortKey === c.key ? (asc ? " ▲" : " ▼") : ""}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {view.length === 0 ? (
                                <tr><td colSpan={columns.length} className="gun-diag-empty">{"No results"}</td></tr>
                            ) : view.map(r => (
                                <tr
                                    key={r.name}
                                    className={`gun-diag-row lvl-${r.level}`}
                                    // live + heavy (risk > 25) → bolder background to spotlight the worst offenders
                                    style={live && r.risk > 25 ? { background: "rgb(237 66 69 / 22%)" } : undefined}
                                >
                                    <td>{r.name}</td>
                                    <td>
                                        <span
                                            style={{
                                                fontSize: 11,
                                                fontWeight: 600,
                                                padding: "2px 8px",
                                                borderRadius: 8,
                                                whiteSpace: "nowrap",
                                                background: r.type === "continuous" ? "rgb(250 168 26 / 18%)" : "rgb(148 155 164 / 15%)",
                                                color: r.type === "continuous" ? "#faa81a" : "var(--text-muted)",
                                            }}
                                        >
                                            {r.type === "continuous" ? "Continuous" : "On-demand"}
                                        </span>
                                    </td>
                                    <td className="num">{r.hooks}</td>
                                    <td className="num">{r.listeners}</td>
                                    <td className="num">{r.patches}</td>
                                    <td className="num">
                                        {r.pendingPatches > 0
                                            ? <span className="gun-diag-pending">{r.pendingPatches}</span>
                                            : 0}
                                    </td>
                                    <td className="num">{r.uiInjects}</td>
                                    <td className="num">
                                        {(() => {
                                            const base = baseline?.risks[r.name];
                                            const d = base != null ? Math.round((r.risk - base) * 10) / 10 : null;
                                            const show = d != null && Math.abs(d) >= 1;
                                            return (
                                                // One nowrap row: the badge is a padded pill, so letting the
                                                // delta be a loose sibling made it wrap under the number.
                                                <div className="gun-diag-weight">
                                                    <span className={`gun-diag-badge ${r.level}`}>{r.risk}</span>
                                                    {show && (
                                                        <span
                                                            // Lower load is better, so a drop is the good direction.
                                                            className={`gun-diag-delta ${d < 0 ? "better" : "worse"}`}
                                                            title={`vs saved baseline (${new Date(baseline!.takenAt).toLocaleDateString()})`}
                                                        >
                                                            {d < 0 ? `▼${Math.abs(d)}` : `▲${d}`}
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="gun-diag-foot">
                    {view.length} / {rows.length} {"plugins"}
                    {"  ·  "}{"Continuous"}: {summary.continuous}/{summary.total}
                    {"  ·  "}{"Total load"}: {summary.totalRisk}
                    {baseline && (() => {
                        const baseTotal = Object.values(baseline.risks).reduce((a, b) => a + b, 0);
                        const dt = Math.round((summary.totalRisk - baseTotal) * 10) / 10;
                        const added = rows.filter(r => baseline.risks[r.name] == null).length;
                        return (
                            <>
                                {"  ·  "}
                                {
                                    `vs baseline (${new Date(baseline.takenAt).toLocaleDateString()}): load ${dt >= 0 ? "+" : ""}${dt}${added ? `, +${added} new plugins` : ""}`
                                }
                            </>
                        );
                    })()}
                </div>
            </div>
        </Modal>
    );
}
