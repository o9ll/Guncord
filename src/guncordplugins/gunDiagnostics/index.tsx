/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { HeaderBarButton } from "@api/HeaderBar";
import { showNotification } from "@api/Notifications";
import { definePluginSettings, useSettings } from "@api/Settings";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin, { OptionType } from "@utils/types";
import { Button, openModal, React } from "@webpack/common";

import { DiagnosticsModal } from "./DiagnosticsModal";
import { startMemoryGuard, stopMemoryGuard } from "./memoryGuard";
import { runtimeProfiler } from "./runtimeProfiler";
import { sampleHeapMB, scanPlugins } from "./scanner";
import { processSnapshot } from "./scoring";

// Scanner (layer 1) → Processing (layer 2). One synchronous pass, on demand.
function runScan() {
    return processSnapshot(scanPlugins());
}

function openDiagnostics() {
    const initial = runScan(); // single pass at click time
    const heapMB = sampleHeapMB();
    const interval = settings.store.liveInterval ?? 5; // live-monitoring refresh seconds
    openModal(props => (
        <ErrorBoundary>
            <DiagnosticsModal modalProps={props} initial={initial} heapMB={heapMB} rescan={runScan} interval={interval} />
        </ErrorBoundary>
    ));
    // `initial` is referenced only by the modal closure; released for GC when the modal unmounts.
}

// activity / heartbeat icon
function DiagnosticsIcon({ width = 20, height = 20, ...props }: React.SVGProps<SVGSVGElement>) {
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M3 12h4l3 8 4-16 3 8h4" />
        </svg>
    );
}

// A recording keeps running after the modal closes, so the icon is the only thing
// that can tell you it is still going — without it you would leave it recording forever.
function useIsRecording() {
    const [rec, setRec] = React.useState(runtimeProfiler.recording);
    React.useEffect(() => runtimeProfiler.subscribeState(() => setRec(runtimeProfiler.recording)), []);
    return rec;
}

function HeaderBarDiagnosticsButton() {
    useSettings(["plugins.Settings.arabicMode"]);
    const recording = useIsRecording();
    return (
        <HeaderBarButton
            icon={() => <DiagnosticsIcon className={recording ? "gun-diag-recording" : undefined} />}
            tooltip={recording
                ? "⏺ Recording profile — click to view or stop"
                : "Gun Diagnostics"}
            onClick={openDiagnostics}
        />
    );
}

function armMemoryGuard() {
    startMemoryGuard(growthMB => {
        showNotification({
            title: "GunDiagnostics",
            body: `Possible memory leak: the heap baseline grew ~${growthMB}MB over the last 15 minutes despite garbage collection. Open Diagnostics to isolate the cause.`,
            color: "#faa81a",
            onClick: openDiagnostics
        });
    });
}

const settings = definePluginSettings({
    liveInterval: {
        type: OptionType.SLIDER,
        description: "Live-monitoring refresh interval (seconds)",
        markers: [3, 5, 10, 15, 30],
        default: 5,
        stickToMarkers: true,
    },
    memoryGuard: {
        type: OptionType.BOOLEAN,
        description: "🛡️ Memory guard (optional): ultra-light background watch (one sample/minute) that notifies you once if sustained leak-like memory growth is detected — off by default.",
        default: false,
        onChange(value: boolean) {
            if (value) armMemoryGuard();
            else stopMemoryGuard();
        }
    },
    open: {
        type: OptionType.COMPONENT,
        component: () => (
            <Button onClick={openDiagnostics}>{"Scan Diagnostics"}</Button>
        ),
    },
});

export default definePlugin({
    name: "GunDiagnostics",
    description: "On-demand diagnostics suite: plugin footprint snapshots, live profiling (CPU/RAM/FPS/event-loop/Flux dispatch), unapplied-patch audit, a real causal impact test that measures a plugin ON vs OFF, baseline comparison and measurement-backed recommendations. Zero cost when idle.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    tags: ["Utility"],
    dependencies: ["HeaderBarAPI"],
    settings,

    headerBarButton: {
        icon: DiagnosticsIcon,
        render: HeaderBarDiagnosticsButton,
    },

    start() {
        if (settings.store.memoryGuard) armMemoryGuard();
    },

    stop() {
        stopMemoryGuard();
        // A recording no longer dies with the modal, so disabling the plugin is the
        // only remaining backstop — otherwise its timers and the __gunProf global
        // would outlive the plugin itself.
        runtimeProfiler.stop();
    },
});
