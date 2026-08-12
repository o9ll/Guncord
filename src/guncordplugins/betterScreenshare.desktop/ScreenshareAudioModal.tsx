/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import { ModalContent, ModalHeader, ModalRoot, type RenderModalProps } from "@utils/gunModals";
import { ModalSize } from "@utils/modal";
import { React } from "@webpack/common";

import { Cap, NumTile, ProfileBar, RangeBar, Seg, Switch, Tile } from "./ScreenshareModal";

const CHANNELS: [string, number][] = [["Mono", 1], ["Stereo", 2]];
const BITRATES: [string, number][] = [["96", 96], ["128", 128], ["256", 256], ["320", 320]];

function AudioBody({ st, apply }: { st: any; apply: () => void; }) {
    const p = st.currentProfile;
    const simple = st.simpleMode ?? true;
    const setChannels = (v: number) => { st.setChannels(v); st.setChannelsEnabled(true); apply(); };
    const setBitrate = (v: number) => { st.setVoiceBitrate(v); st.setVoiceBitrateEnabled(true); apply(); };

    return (
        <>
            <div className="bss-tile bss-tap bss-span" onClick={() => st.setSimpleMode(!simple)}>
                <Cap label={"Simple mode"}><Switch on={simple} onChange={v => st.setSimpleMode(v)} /></Cap>
                <span className="bss-note">{simple ? "Channels and quality only — turn off for full control." : "Advanced — every audio-encoding parameter."}</span>
            </div>

            {simple ? (
                <>
                    <Tile span>
                        <Cap label={"Channels"} value={p.channels === 1 ? "Mono" : "Stereo"} />
                        <Seg options={CHANNELS} current={p.channels ?? 2} onPick={setChannels} />
                    </Tile>
                    <Tile span>
                        <Cap label={"Audio bitrate"} value={`${p.voiceBitrate ?? 320} kb/s`} />
                        <Seg options={BITRATES} current={p.voiceBitrate} onPick={setBitrate} />
                    </Tile>
                </>
            ) : (
                <>
                    <div className="bss-grid2">
                        <NumTile label={"Sample frequency"} unit="Hz" value={p.freq} def={48000}
                            onValue={v => { st.setFreq(v); st.setFreqEnabled(true); apply(); }}
                            enabled={p.freqEnabled} onToggle={v => { st.setFreqEnabled(v); apply(); }} />
                        <NumTile label={"Sample rate"} unit="Hz" value={p.rate} def={48000}
                            onValue={v => { st.setRate(v); st.setRateEnabled(true); apply(); }}
                            enabled={p.rateEnabled} onToggle={v => { st.setRateEnabled(v); apply(); }} />
                        <NumTile label={"Packet size"} value={p.pacsize} def={960}
                            onValue={v => { st.setPacsize(v); st.setPacsizeEnabled(true); apply(); }}
                            enabled={p.pacsizeEnabled} onToggle={v => { st.setPacsizeEnabled(v); apply(); }} />
                        <NumTile label={"Channels"} value={p.channels} def={2}
                            onValue={v => { st.setChannels(v); st.setChannelsEnabled(true); apply(); }}
                            enabled={p.channelsEnabled} onToggle={v => { st.setChannelsEnabled(v); apply(); }} />
                    </div>
                    <Tile span>
                        <Cap label={"Audio bitrate"} value={`${p.voiceBitrate ?? 320} kb/s`}>
                            <Switch on={p.voiceBitrateEnabled ?? false} onChange={v => { st.setVoiceBitrateEnabled(v); apply(); }} />
                        </Cap>
                        <RangeBar value={p.voiceBitrate ?? 320} min={8} max={512} step={8} onInput={setBitrate} />
                    </Tile>
                </>
            )}

            <ProfileBar st={st} apply={apply} />

            <button type="button" className="bss-apply" onClick={apply}>{"✓ Apply to stream"}</button>

            <div className="bss-hint">
                <span className="bss-dot" />
                {"For stereo audio: set channels = Stereo and raise the bitrate, then Apply while live."}
            </div>
        </>
    );
}

export function ScreenshareAudioModal({ rootProps, screenshareAudioStore, onDone }: { rootProps: RenderModalProps; screenshareAudioStore: any; onDone: () => void; }) {
    const st = screenshareAudioStore.use();
    const apply = () => { try { onDone(); } catch { /* safe */ } };

    return (
        <ModalRoot {...rootProps} size={ModalSize.SMALL} className="bss-root">
            <ModalHeader separator={false}>
                <div className="bss-head">
                    <span className="bss-glyph">
                        <svg viewBox="0 0 24 24" fill="#fff" aria-hidden><path d="M4 9v6h4l5 5V4L8 9H4Zm11.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4Zm-2.5-9v2.06a7 7 0 0 1 0 13.88V21a9 9 0 0 0 0-18Z" /></svg>
                    </span>
                    <div>
                        <div className="bss-title">BetterScreenshare</div>
                        <div className="bss-subtitle">{"Shared-audio settings"}</div>
                    </div>
                </div>
            </ModalHeader>
            <ModalContent>
                <div className="bss-body">
                    <ErrorBoundary noop><AudioBody st={st} apply={apply} /></ErrorBoundary>
                </div>
            </ModalContent>
        </ModalRoot>
    );
}
