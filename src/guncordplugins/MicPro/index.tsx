/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { PluginInfo as MicEngineInfo } from "@guncordplugins/_micProEngine/constants";
import { MicrophonePatcher } from "@guncordplugins/_micProEngine/patchers";
import { initMicrophoneStore, microphoneStore } from "@guncordplugins/_micProEngine/stores";
import { addSettingsPanelButton, Emitter, MicrophoneSettingsIcon, removeSettingsPanelButton } from "@guncordplugins/pluginLibrary";
import { ModalContent, ModalHeader, ModalRoot, openModal, type RenderModalProps } from "@utils/gunModals";
import { ModalSize } from "@utils/modal";
import definePlugin, { PluginNative } from "@utils/types";
import { FluxDispatcher, MediaEngineStore, React, Select, useEffect, useRef, useState, VoiceActions } from "@webpack/common";

import { settings } from "./settings";

const Native = IS_DISCORD_DESKTOP
    ? (VencordNative.pluginHelpers.MicPro as PluginNative<typeof import("./native")>)
    : null;

let micPatcher: MicrophonePatcher | undefined;
let nativeReady: boolean | null = null;
let stereoGuardOff: (() => void) | undefined;

type NoiseMode = "none" | "standard" | "krisp";

const DEFAULT_AGC = {
    enabled: true, useAGC2: true, enableAnalog: false, enableDigital: true,
    headroom_db: 5, max_gain_db: 50, initial_gain_db: 15,
    max_gain_change_db_per_second: 6, max_output_noise_level_dbfs: -50, fixed_gain_db: 0
};

function mediaEngine() {
    try { return MediaEngineStore.getMediaEngine(); } catch { return null; }
}
function inCall(): boolean {
    try { return (mediaEngine()?.connections?.size ?? 0) > 0; } catch { return false; }
}
function forEachConnection(fn: (c: any) => void) {
    try { mediaEngine()?.connections?.forEach(fn); } catch { /* safe */ }
}

type ProcState = { echo: boolean; agc: boolean; noiseMode: NoiseMode; vadThreshold: number; };

// The processing intent MicPro owns. Discord's per-connection setters (setEchoCancellation…)
// never update the MediaEngineStore getters, so reading those back would flip the UI off a
// moment after the user toggles. We keep the truth here (persisted) and apply it to the live
// connection(s). Before the user ever touches the panel, we seed from the store's real values.
function storeProc(): ProcState {
    const S = MediaEngineStore as any;
    const suppression = !!S?.getNoiseSuppression?.();
    const cancellation = !!S?.getNoiseCancellation?.();
    return {
        echo: !!S?.getEchoCancellation?.(),
        agc: !!S?.getAutomaticGainControl?.(),
        noiseMode: (cancellation ? "krisp" : suppression ? "standard" : "none") as NoiseMode,
        vadThreshold: Number(S?.getModeOptions?.()?.threshold ?? -60)
    };
}
function currentProc(): ProcState {
    return settings.store.procState ?? storeProc();
}
function saveProc(patch: Partial<ProcState>) {
    settings.store.procState = { ...currentProc(), ...patch };
}

function readState() {
    const S = MediaEngineStore as any;
    const p = currentProc();
    return {
        inputVolume: Number(S?.getInputVolume?.() ?? 100),
        noiseMode: p.noiseMode,
        echo: p.echo,
        agc: p.agc,
        krispSupported: !!S?.isNoiseCancellationSupported?.(),
        inputMode: String(S?.getInputMode?.() ?? "VOICE_ACTIVITY"),
        vadThreshold: p.vadThreshold,
        deviceId: String(S?.getInputDeviceId?.() ?? "default"),
        inCall: inCall()
    };
}

function applyNoiseTo(c: any, mode: NoiseMode) {
    if (mode === "krisp") { c.setNoiseSuppression(false); c.setNoiseCancellation(true); }
    else if (mode === "standard") { c.setNoiseCancellation(false); c.setNoiseSuppression(true); }
    else { c.setNoiseCancellation(false); c.setNoiseSuppression(false); }
}
function applySensitivityTo(c: any, mode: string, thresholdDb: number) {
    const cur = (MediaEngineStore as any)?.getModeOptions?.() ?? {};
    c.setInputMode(mode, {
        vadThreshold: thresholdDb, vadAutoThreshold: false,
        vadUseKrisp: cur.vadUseKrisp, vadKrispActivationThreshold: cur.vadKrispActivationThreshold
    });
}

// Re-applies the whole owned intent to one connection — used when a call starts, so the
// user's choices actually take effect on every call (Discord would otherwise reset them).
function applyProcToConnection(c: any) {
    const p = currentProc();
    const mode = String((MediaEngineStore as any)?.getInputMode?.() ?? "VOICE_ACTIVITY");
    try {
        c.setEchoCancellation(p.echo);
        c.setAutomaticGainControl({ ...DEFAULT_AGC, enabled: p.agc });
        applyNoiseTo(c, p.noiseMode);
        applySensitivityTo(c, mode, p.vadThreshold);
    } catch { /* safe */ }
}

// Each setter persists the intent (so the panel doesn't flip back) AND applies it live.
const apply = {
    inputVolume(v: number) { try { FluxDispatcher.dispatch({ type: "AUDIO_SET_INPUT_VOLUME", volume: v }); } catch { /* safe */ } },
    echo(on: boolean) { saveProc({ echo: on }); forEachConnection(c => c.setEchoCancellation(on)); },
    agc(on: boolean) { saveProc({ agc: on }); forEachConnection(c => c.setAutomaticGainControl({ ...DEFAULT_AGC, enabled: on })); },
    noise(mode: NoiseMode) { saveProc({ noiseMode: mode }); forEachConnection(c => applyNoiseTo(c, mode)); },
    sensitivity(mode: string, thresholdDb: number) { saveProc({ vadThreshold: thresholdDb }); forEachConnection(c => applySensitivityTo(c, mode, thresholdDb)); }
};

function disableMonoBreakers(c: any) {
    try {
        c.setNoiseCancellation(false);
        c.setNoiseSuppression(false);
        c.setEchoCancellation(false);
        c.setAutomaticGainControl({ ...DEFAULT_AGC, enabled: false });
    } catch { /* safe */ }
}

let savedProcessing: { noiseMode: NoiseMode; echo: boolean; agc: boolean; } | null = null;

function toggleStereo(st: any, on: boolean, flush: () => void) {
    if (on) {
        if (savedProcessing == null) {
            const s = readState();
            savedProcessing = { noiseMode: s.noiseMode, echo: s.echo, agc: s.agc };
        }
        st.setChannels(2);
        st.setChannelsEnabled(true);
        apply.noise("none");
        apply.echo(false);
        apply.agc(false);
    } else {
        st.setChannelsEnabled(false);
        if (savedProcessing != null) {
            apply.noise(savedProcessing.noiseMode);
            apply.echo(savedProcessing.echo);
            apply.agc(savedProcessing.agc);
            savedProcessing = null;
        }
    }
    flush();
}

let loopbackOn = false;
let deafenedByUs = false;

async function setLoopback(on: boolean, autoDeafen: boolean) {
    try {
        await VoiceActions.setLoopback("mic_test", on);
        loopbackOn = on;
        if (on && autoDeafen && !(MediaEngineStore as any)?.isSelfDeaf?.()) {
            await VoiceActions.toggleSelfDeaf(); deafenedByUs = true;
        } else if (!on && deafenedByUs && (MediaEngineStore as any)?.isSelfDeaf?.()) {
            await VoiceActions.toggleSelfDeaf(); deafenedByUs = false;
        }
    } catch { /* safe */ }
}

async function openLevelStream(): Promise<MediaStream> {
    let id = "";
    try { id = String((MediaEngineStore as any)?.getInputDeviceId?.() ?? ""); } catch { /* safe */ }
    if (id && id !== "default") {
        try { return await navigator.mediaDevices.getUserMedia({ audio: { deviceId: { ideal: id } } }); }
        catch { /* Drops to the default below */ }
    }
    return navigator.mediaDevices.getUserMedia({ audio: true });
}

function useLiveLevel(): number {
    const [level, setLevel] = useState(0);
    const ref = useRef<{ ctx?: AudioContext; stream?: MediaStream; raf?: number; }>({});

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const stream = await openLevelStream();
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
                const ctx = new AudioContext();
                if (ctx.state === "suspended") { try { await ctx.resume(); } catch { /* ignore */ } }
                if (cancelled) { stream.getTracks().forEach(t => t.stop()); ctx.close().catch(() => { }); return; }
                const analyser = ctx.createAnalyser();
                analyser.fftSize = 512;
                ctx.createMediaStreamSource(stream).connect(analyser);
                const buf = new Uint8Array(analyser.fftSize);
                ref.current = { ctx, stream };
                const tick = () => {
                    analyser.getByteTimeDomainData(buf);
                    let sum = 0;
                    for (let i = 0; i < buf.length; i++) { const d = (buf[i] - 128) / 128; sum += d * d; }
                    setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 3.2));
                    ref.current.raf = requestAnimationFrame(tick);
                };
                tick();
            } catch (e) {
                console.error("[MicPro] live input meter unavailable:", e);
            }
        })();
        return () => {
            cancelled = true;
            const r = ref.current;
            if (r.raf) cancelAnimationFrame(r.raf);
            r.stream?.getTracks().forEach(t => t.stop());
            r.ctx?.close().catch(() => { });
            ref.current = {};
        };
    }, []);

    return level;
}

function InputLevel({ gain, onGain }: { gain: number; onGain: (v: number) => void; }) {
    const level = useLiveLevel();
    return (
        <div className="micpro-il">
            <span className="micpro-il-live" style={{ width: `${Math.round(level * 100)}%` }} />
            <input type="range" min={0} max={100} value={gain} aria-label="input level"
                onChange={e => onGain(Number(e.currentTarget.value))} />
        </div>
    );
}

function Tile({ span, tap, onClick, children }: { span?: boolean; tap?: boolean; onClick?: () => void; children: React.ReactNode; }) {
    return (
        <div className={"micpro-tile" + (span ? " micpro-span" : "") + (tap ? " micpro-tap" : "")} onClick={onClick}>
            {children}
        </div>
    );
}
function Cap({ label, value, children }: { label: string; value?: string; children?: React.ReactNode; }) {
    return (
        <div className="micpro-cap">
            <span className="micpro-label">{label}</span>
            {value != null && <span className="micpro-val">{value}</span>}
            {children}
        </div>
    );
}
function Switch({ on, accent, disabled, onChange }: { on: boolean; accent?: boolean; disabled?: boolean; onChange: (v: boolean) => void; }) {
    return (
        <button type="button" role="switch" aria-checked={on} disabled={disabled}
            className={"micpro-sw" + (accent ? " micpro-sw-acc" : "") + (on ? " micpro-sw-on" : "")}
            onClick={e => { e.stopPropagation(); onChange(!on); }}>
            <i />
        </button>
    );
}
function SwitchTile({ label, note, on, span, disabled, onChange }: { label: string; note: string; on: boolean; span?: boolean; disabled?: boolean; onChange: (v: boolean) => void; }) {
    return (
        <Tile span={span} tap onClick={() => !disabled && onChange(!on)}>
            <Cap label={label}><Switch on={on} accent disabled={disabled} onChange={onChange} /></Cap>
            <span className="micpro-note">{note}</span>
        </Tile>
    );
}
function RangeBar({ value, min, max, step, disabled, onInput }:
{ value: number; min: number; max: number; step?: number; disabled?: boolean; onInput: (v: number) => void; }) {
    const pct = max > min ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100)) : 0;
    return (
        <div className={"micpro-range" + (disabled ? " micpro-range-off" : "")}>
            <span className="micpro-range-fill" style={{ width: `${pct}%` }} />
            <input type="range" min={min} max={max} step={step ?? 1} value={value} disabled={disabled}
                onChange={e => onInput(Number(e.currentTarget.value))} />
        </div>
    );
}
function SliderTile({ label, value, min, max, step, span, disabled, onInput }:
{ label: string; value: number; min: number; max: number; step?: number; span?: boolean; disabled?: boolean; onInput: (v: number) => void; }) {
    return (
        <Tile span={span}>
            <Cap label={label} value={disabled ? undefined : `${value}${max === 100 ? "%" : ""}`} />
            <RangeBar value={value} min={min} max={max} step={step} disabled={disabled} onInput={onInput} />
        </Tile>
    );
}
function NumberTile({ label, hint, unit, def, enabled, value, onToggle, onValue }:
{ label: string; hint: string; unit?: string; def: number; enabled: boolean; value?: number; onToggle: (v: boolean) => void; onValue: (v: number) => void; }) {
    return (
        <Tile>
            <Cap label={label}>
                <Switch on={enabled} accent onChange={v => { onToggle(v); if (v && value == null) onValue(def); }} />
            </Cap>
            <div className="micpro-numwrap">
                <input className="micpro-num" type="number" disabled={!enabled} value={value ?? ""} placeholder={String(def)}
                    onChange={e => { const n = parseInt(e.currentTarget.value, 10); if (Number.isFinite(n)) onValue(n); }} />
                {unit && <span className="micpro-unit">{unit}</span>}
            </div>
            <span className="micpro-note">{hint}</span>
        </Tile>
    );
}

function ProfileBar({ st, flush }: { st: any; flush: () => void; }) {
    const [saving, setSaving] = useState(false);
    const [nameInput, setNameInput] = useState("");

    const name: string = st.currentProfile?.name ?? "";
    const call = <T,>(fn: () => T, dflt: T): T => { try { return fn(); } catch { return dflt; } };
    const profiles: { name: string; }[] = call(() => st.getProfiles(true), []);
    const isDefault = call(() => st.isCurrentProfileADefaultProfile(), false);

    const save = () => {
        if (!saving) { setNameInput(name); setSaving(true); return; }
        const nm = nameInput.trim();
        if (!nm || call(() => st.getDefaultProfiles().some((v: any) => v.name === nm), false)) return;
        st.saveProfile({ ...st.getCurrentProfile(), name: nm });
        st.setCurrentProfile(st.getProfile(nm) || { name: "" });
        setSaving(false);
        flush();
    };
    const newProfile = () => st.setCurrentProfile({ name: "" });
    const copy = () => { st.setCurrentProfile({ ...st.getCurrentProfile(), name: "" }); setNameInput(""); setSaving(true); };
    const del = () => {
        st.deleteProfile(st.currentProfile);
        st.setCurrentProfile(call(() => st.getDefaultProfiles()[0], { name: "" }) ?? { name: "" });
        flush();
    };
    const pick = (v: string) => { st.setCurrentProfile(st.getProfile(v) || { name: "" }); flush(); };

    return (
        <Tile span>
            <Cap label={"Profile"} value={name || "unsaved"} />
            <div className="micpro-profrow">
                {saving ? (
                    <input className="micpro-num micpro-profname" type="text" placeholder={"Profile name…"}
                        value={nameInput} onChange={e => setNameInput(e.currentTarget.value)}
                        onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setSaving(false); }} />
                ) : (
                    <div className="micpro-profsel">
                        <Select
                            isSelected={v => v === name}
                            options={[
                                ...(name === "" ? [{ label: "(unsaved)", value: "" }] : []),
                                ...profiles.map(pr => ({ label: pr.name, value: pr.name }))
                            ]}
                            select={pick}
                            serialize={String}
                            closeOnSelect
                        />
                    </div>
                )}
                <button type="button" className="micpro-pbtn micpro-pbtn-save" title={"Save"} onClick={save}>{saving ? "✓" : "💾"}</button>
                <button type="button" className="micpro-pbtn" title={"New"} disabled={saving} onClick={newProfile}>＋</button>
                <button type="button" className="micpro-pbtn" title={"Copy"} disabled={saving} onClick={copy}>⧉</button>
                <button type="button" className="micpro-pbtn micpro-pbtn-del" title={"Delete"} disabled={saving || isDefault || !name} onClick={del}>🗑</button>
            </div>
        </Tile>
    );
}

const SIMPLE_BITRATES: [number, string][] = [
    [96, "Normal"], [160, "Medium-High"],
    [320, "High"], [512, "Very High"]
];

function TransmissionPane() {
    if (!IS_DISCORD_DESKTOP || micPatcher == null || microphoneStore == null) {
        return <p className="micpro-empty">{"High-quality transmission is desktop-only."}</p>;
    }
    return <ErrorBoundary noop><TransmissionControls /></ErrorBoundary>;
}

function TransmissionControls() {
    const st = microphoneStore.use();
    const { currentProfile: p } = st;
    const simple = st.simpleMode ?? true;
    const flush = () => { try { micPatcher?.forceUpdateTransportationOptions(); } catch { /* safe */ } };
    const stereoOn = p.channelsEnabled === true && (p.channels ?? 1) >= 2;

    return (
        <>
            <ProfileBar st={st} flush={flush} />

            <SwitchTile
                label={"Simple mode"}
                note={simple ? "On — easy options. Turn off for advanced settings." : "Advanced — full control over transport parameters."}
                on={simple}
                onChange={v => st.setSimpleMode(v)}
            />

            {simple ? (
                <>
                    <SwitchTile span label={"Stereo"} note={"2 channels"} on={stereoOn}
                        onChange={v => { toggleStereo(st, v, flush); }} />

                    {stereoOn && (
                        <div className="micpro-warn">
                            ⚠️ {"To keep stereo working we automatically turned off noise suppression, echo cancellation and AGC — they downmix your mic to mono and break stereo."}
                        </div>
                    )}

                    <Tile span>
                        <Cap label={"Audio quality"} value={SIMPLE_BITRATES.find(([v]) => v === (p.voiceBitrate ?? 96))?.[1]} />
                        <div className="micpro-seg">
                            {SIMPLE_BITRATES.map(([v]) => (
                                <button key={v} type="button"
                                    className={"micpro-seg-btn" + ((p.voiceBitrate ?? 96) === v ? " micpro-seg-on" : "")}
                                    onClick={() => { st.setVoiceBitrate(v); st.setVoiceBitrateEnabled(true); flush(); }}>{v}</button>
                            ))}
                        </div>
                    </Tile>
                </>
            ) : (
                <>
                    <SliderTile span label={"Bitrate"} value={p.voiceBitrate ?? 96} min={8} max={512} step={8}
                        onInput={v => { st.setVoiceBitrate(v); st.setVoiceBitrateEnabled(true); flush(); }} />
                    <div className="micpro-grid2">
                        <NumberTile label={"Channels"} hint={"1 = mono · 2 = stereo"} def={2}
                            enabled={p.channelsEnabled ?? false} value={p.channels}
                            onToggle={v => { st.setChannelsEnabled(v); flush(); }} onValue={v => { st.setChannels(v); flush(); }} />
                        <NumberTile label={"Sample rate"} hint={"Encode rate — higher is clearer"} unit="Hz" def={48000}
                            enabled={p.rateEnabled ?? false} value={p.rate}
                            onToggle={v => { st.setRateEnabled(v); flush(); }} onValue={v => { st.setRate(v); flush(); }} />
                        <NumberTile label={"Frequency"} hint={"Samples/sec — default 48000"} unit="Hz" def={48000}
                            enabled={p.freqEnabled ?? false} value={p.freq}
                            onToggle={v => { st.setFreqEnabled(v); flush(); }} onValue={v => { st.setFreq(v); flush(); }} />
                        <NumberTile label={"Packet size"} hint={"Samples per packet — default 960"} def={960}
                            enabled={p.pacsizeEnabled ?? false} value={p.pacsize}
                            onToggle={v => { st.setPacsizeEnabled(v); flush(); }} onValue={v => { st.setPacsize(v); flush(); }} />
                    </div>
                </>
            )}

            {/* Apply the current settings/file to your ongoing call (re-push live transfer options) —
               Useful after changing the settings file. Individual changes are applied live, ensuring that everything is pushed. */}
            <button type="button" className="micpro-apply" onClick={flush}>
                {"✓ Apply to call"}
            </button>

            {nativeReady === false ? (
                <div className="micpro-warn">⚠️ {"The stereo engine didn't load, so audio won't actually transmit in stereo. Restart Discord; if it persists, check your internet connection."}</div>
            ) : (
                <div className="micpro-hint">
                    <span className="micpro-dot" />
                    {nativeReady
                        ? "Stereo engine ready — applies to your current call."
                        : "Applies to your current call via Discord's native engine."}
                </div>
            )}
        </>
    );
}

function ProcessingPane() {
    const [s, setS] = useState(readState);
    const [testing, setTesting] = useState(loopbackOn);

    useEffect(() => {
        const resync = () => setS(readState());
        const id = setInterval(resync, 1000);
        let subbed = false;
        try { (MediaEngineStore as any).addChangeListener?.(resync); subbed = true; } catch { /* safe */ }
        return () => {
            clearInterval(id);
            if (subbed) { try { (MediaEngineStore as any).removeChangeListener?.(resync); } catch { /* safe */ } }
        };
    }, []);

    const isVAD = s.inputMode === "VOICE_ACTIVITY";
    const sensitivityPct = Math.round(Math.max(0, Math.min(100, s.vadThreshold + 100)));
    const off = !s.inCall;

    return (
        <>
            <Tile span>
                <Cap label={"Input level"} value={`${Math.round(s.inputVolume)}%`} />
                <InputLevel gain={Math.round(s.inputVolume)}
                    onGain={v => { apply.inputVolume(v); setS(p => ({ ...p, inputVolume: v })); }} />
            </Tile>

            <SliderTile span label={"Sensitivity"} value={sensitivityPct} min={0} max={100} disabled={!isVAD}
                onInput={v => { const db = v - 100; apply.sensitivity(s.inputMode, db); setS(p => ({ ...p, vadThreshold: db })); }} />

            <div className="micpro-note">{"Drag the input level to set your mic gain; the colored bar shows your live voice."}</div>

            <Tile span>
                <Cap label={"Noise reduction"} />
                <div className="micpro-seg">
                    {([["none", "None"], ["standard", "Standard"], ["krisp", "Krisp"]] as [NoiseMode, string][]).map(([mode, lbl]) => (
                        <button key={mode} type="button" disabled={mode === "krisp" && !s.krispSupported}
                            className={"micpro-seg-btn" + (s.noiseMode === mode ? " micpro-seg-on" : "")}
                            onClick={() => { apply.noise(mode); setS(p => ({ ...p, noiseMode: mode })); }}>{lbl}</button>
                    ))}
                </div>
            </Tile>

            <div className="micpro-grid2">
                <SwitchTile label={"Echo cancel"} note={"Removes speaker echo"} on={s.echo}
                    onChange={v => { apply.echo(v); setS(p => ({ ...p, echo: v })); }} />
                <SwitchTile label={"Auto AGC"} note={"Auto gain balancing"} on={s.agc}
                    onChange={v => { apply.agc(v); setS(p => ({ ...p, agc: v })); }} />
            </div>

            <button type="button" className={"micpro-test" + (testing ? " micpro-test-live" : "")}
                onClick={async () => { const next = !testing; setTesting(next); await setLoopback(next, settings.store.autoDeafenOnTest); }}>
                {testing ? "⏹  Stop test" : "🎧  Test microphone (hear yourself)"}
            </button>

            {off && <div className="micpro-hint">{"Your settings are saved and applied automatically to your current and next call."}</div>}
        </>
    );
}

function MicIconGlyph() {
    return (
        <span className="micpro-glyph">
            <svg viewBox="0 0 24 24" fill="#fff" aria-hidden>
                <path d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Z" />
                <path d="M18 12a1 1 0 1 0-2 0 4 4 0 0 1-8 0 1 1 0 1 0-2 0 6 6 0 0 0 5 5.91V20H8.5a1 1 0 1 0 0 2h7a1 1 0 1 0 0-2H13v-2.09A6 6 0 0 0 18 12Z" />
            </svg>
        </span>
    );
}

function MicProModal({ rootProps }: { rootProps: RenderModalProps; }) {
    const [tab, setTab] = useState<"proc" | "trans">("proc");
    useEffect(() => () => { if (loopbackOn) void setLoopback(false, settings.store.autoDeafenOnTest); }, []);

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL} className="micpro-root">
            <ModalHeader separator={false}>
                <div className="micpro-head">
                    <MicIconGlyph />
                    <div>
                        <div className="micpro-title">MicPro</div>
                        <div className="micpro-subtitle">{"Microphone control panel"}</div>
                    </div>
                </div>
            </ModalHeader>
            <ModalContent>
                <div className="micpro-tabs">
                    <button type="button" className={"micpro-tab" + (tab === "proc" ? " micpro-tab-on" : "")} onClick={() => setTab("proc")}>{"Processing"}</button>
                    <button type="button" className={"micpro-tab" + (tab === "trans" ? " micpro-tab-on" : "")} onClick={() => setTab("trans")}>{"Transmission"}</button>
                </div>
                <div className="micpro-body">
                    {tab === "proc" ? <ProcessingPane /> : <TransmissionPane />}
                </div>
            </ModalContent>
        </ModalRoot>
    );
}

function openPanel() {
    openModal(props => (
        <ErrorBoundary>
            <MicProModal rootProps={props} />
        </ErrorBoundary>
    ));
}

export default definePlugin({
    name: "MicPro",
    description: "One microphone control panel next to the mute button: live level meter, gain, noise reduction (None/Standard/Krisp), echo cancellation, AGC and voice sensitivity — all on Discord's native engine so they affect what others hear — plus a real loopback test and high-quality stereo transmission with Simple/Advanced modes.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    tags: ["Voice", "Utility"],
    dependencies: ["PluginLibrary"],
    settings,
    requiresRestart: true,

    start() {
        addSettingsPanelButton({
            name: "MicPro",
            icon: MicrophoneSettingsIcon,
            get tooltipText() { return "Microphone panel · MicPro"; },
            onClick: openPanel
        });

        if (!IS_DISCORD_DESKTOP) return;
        try {
            initMicrophoneStore();
            micPatcher = new MicrophonePatcher().patch();

            const me = mediaEngine() as any;
            if (me?.emitter) {
                stereoGuardOff = Emitter.addListener(me.emitter, "on", "connection", (connection: any) => {
                    try {
                        if (connection?.context !== "default") return;
                        const p = microphoneStore?.get?.().currentProfile;
                        const stereo = p?.channelsEnabled === true && (p.channels ?? 1) >= 2;
                        // Stereo needs noise/echo/AGC off (they downmix to mono) — it wins.
                        // Otherwise re-apply the user's processing intent so it sticks per call.
                        if (stereo) disableMonoBreakers(connection);
                        else applyProcToConnection(connection);
                    } catch { /* safe */ }
                }, "MicPro");
            }

            const nativeModules = globalThis.DiscordNative?.nativeModules;
            if (!nativeModules?.requireModule) throw new Error("DiscordNative.nativeModules is unavailable");
            nativeModules.requireModule("discord_voice");
            Native?.applyPatches().then(result => {
                if (result.error) { nativeReady = false; console.error("[MicPro] stereo engine failed:", result.error); return; }
                nativeReady = result.ok > 0;
                console.log(`[MicPro] ${result.module_base} | patches: ok:${result.ok} failed:${result.failed} skipped:${result.skipped}`);
            }).catch(e => { nativeReady = false; console.error("[MicPro]", e); });
        } catch (e) {
            console.error("[MicPro] stereo engine init failed", e);
        }
    },

    stop() {
        removeSettingsPanelButton("MicPro");
        if (loopbackOn) void setLoopback(false, settings.store.autoDeafenOnTest);
        try { stereoGuardOff?.(); } catch { /* safe */ }
        stereoGuardOff = undefined;
        try {
            micPatcher?.unpatch();
            Emitter.removeAllListeners(MicEngineInfo.PLUGIN_NAME);
        } catch (e) { console.error("[MicPro] stop cleanup failed", e); }
        micPatcher = undefined;
    }
});
