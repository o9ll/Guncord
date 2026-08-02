import { Toasts } from "@webpack/common";
import { t } from "../autoTranslateGuncord";
import fixWebmDuration from "fix-webm-duration";

export interface RecordingOptions {
    mode: "voice" | "video";
    videoQuality?: string;
    maxStorageGB: number;
    shadowplayMinutes: number;
    autoSave: boolean;
    savePath: string;
}

let isRecording = false;
let mediaRecorder: MediaRecorder | null = null;
let recordCtx: AudioContext | null = null;
let recordDest: MediaStreamAudioDestinationNode | null = null;
let micStream: MediaStream | null = null;
let systemStream: MediaStream | null = null;

let recordedChunks: Blob[] = [];
const CHUNK_TIME_MS = 5000;
let startTimeMs = 0;
let memoryCheckInterval: any;

export function getRecordingDurationMs(): number {
    if (!isRecording) return 0;
    return Date.now() - startTimeMs;
}

export function isCurrentlyRecording(): boolean {
    return isRecording;
}

export async function startRecording(opts: RecordingOptions): Promise<boolean> {
    if (isRecording) return false;
    
    try {
        recordedChunks = [];
        startTimeMs = Date.now();
        
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        recordCtx = new AudioCtxClass();
        recordDest = recordCtx.createMediaStreamDestination();

        let capturedMic = false;
        let capturedSystem = false;

        try {
            micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (micStream && micStream.getAudioTracks().length > 0) {
                const micSource = recordCtx.createMediaStreamSource(micStream);
                micSource.connect(recordDest);
                capturedMic = true;
            }
        } catch (e) {
            console.warn("[AutoCallRecorder] Impossible de capturer le micro local:", e);
        }

        try {
            let desktopSourceId: string | null = null;
            const nativeCapture = (window as any).VencordNative?.desktopCapture;
            if (nativeCapture?.getSources) {
                const sources = await nativeCapture.getSources();
                const screenSource = sources.find((s: any) => s.id.startsWith("screen:"));
                if (screenSource) desktopSourceId = screenSource.id;
            }

            if (desktopSourceId) {
                const constraints: any = {
                    audio: {
                        mandatory: {
                            chromeMediaSource: "desktop",
                            chromeMediaSourceId: desktopSourceId
                        }
                    }
                };

                if (opts.mode === "video") {
                    let minWidth = 1280;
                    let minHeight = 720;
                    let maxFrameRate = 30;
                    
                    if (opts.videoQuality === "1080p60") {
                        minWidth = 1920;
                        minHeight = 1080;
                        maxFrameRate = 60;
                    } else if (opts.videoQuality === "480p25") {
                        minWidth = 854;
                        minHeight = 480;
                        maxFrameRate = 25;
                    }

                    constraints.video = {
                        mandatory: {
                            chromeMediaSource: "desktop",
                            chromeMediaSourceId: desktopSourceId,
                            minWidth,
                            minHeight,
                            maxFrameRate
                        }
                    };
                } else {
                    constraints.video = {
                        mandatory: {
                            chromeMediaSource: "desktop",
                            chromeMediaSourceId: desktopSourceId,
                            maxWidth: 1, maxHeight: 1
                        }
                    };
                }

                systemStream = await navigator.mediaDevices.getUserMedia(constraints);

                if (systemStream && systemStream.getAudioTracks().length > 0) {
                    const sysAudioStream = new MediaStream(systemStream.getAudioTracks());
                    const systemSource = recordCtx.createMediaStreamSource(sysAudioStream);
                    systemSource.connect(recordDest);
                    capturedSystem = true;
                }
            }
        } catch (e) {
            console.warn("[AutoCallRecorder] Échec du Desktop Loopback:", e);
        }

        if (!capturedMic && !capturedSystem) {
            throw new Error("Aucune source audio capturée.");
        }

        let finalStream = recordDest.stream;
        if (opts.mode === "video" && systemStream) {
            finalStream = new MediaStream([
                ...systemStream.getVideoTracks(),
                ...recordDest.stream.getAudioTracks()
            ]);
        }

        const mimeType = (opts.mode === "video") 
            ? "video/webm;codecs=vp8,opus" 
            : (MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm");

        mediaRecorder = new MediaRecorder(finalStream, { mimeType });

        mediaRecorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) {
                recordedChunks.push(e.data);
            }
        };

        mediaRecorder.start(CHUNK_TIME_MS);
        isRecording = true;
        
        memoryCheckInterval = setInterval(() => {
            if (!isRecording) return;
            
            if (opts.maxStorageGB > 0) {
                const maxBytes = opts.maxStorageGB * 1024 * 1024 * 1024;
                let currentBytes = recordedChunks.reduce((acc, chunk) => acc + chunk.size, 0);
                while (currentBytes > maxBytes && recordedChunks.length > 1) {
                    const removed = recordedChunks.shift();
                    currentBytes -= (removed?.size || 0);
                }
            }

            if (opts.shadowplayMinutes > 0) {
                const maxChunks = (opts.shadowplayMinutes * 60 * 1000) / CHUNK_TIME_MS;
                while (recordedChunks.length > maxChunks) {
                    recordedChunks.shift();
                }
            }
        }, CHUNK_TIME_MS);

        return true;
    } catch (e) {
        console.error(e);
        cleanup();
        return false;
    }
}

export function stopRecording(opts: RecordingOptions): Promise<void> {
    return new Promise((resolve) => {
        if (!isRecording || !mediaRecorder) {
            cleanup();
            resolve();
            return;
        }

        const durationSecs = (Date.now() - startTimeMs) / 1000;
        const shouldSave = durationSecs >= 10; 

        mediaRecorder.onstop = async () => {
            if (shouldSave && recordedChunks.length > 0) {
                const blob = new Blob(recordedChunks, { type: mediaRecorder?.mimeType || "audio/webm" });
                try {
                    const durationMs = Date.now() - startTimeMs;
                    const fixedBlob = await fixWebmDuration(blob, durationMs);
                    saveBlob(fixedBlob, opts);
                } catch (e) {
                    console.error("Failed to fix WebM duration:", e);
                    saveBlob(blob, opts); // fallback to unfixed
                }
            }
            cleanup();
            resolve();
        };

        try {
            if (mediaRecorder.state !== "inactive") {
                mediaRecorder.requestData();
                mediaRecorder.stop();
            } else {
                cleanup();
                resolve();
            }
        } catch(e) {
            cleanup();
            resolve();
        }
    });
}

function cleanup() {
    isRecording = false;
    clearInterval(memoryCheckInterval);
    if (micStream) { micStream.getTracks().forEach(t => t.stop()); micStream = null; }
    if (systemStream) { systemStream.getTracks().forEach(t => t.stop()); systemStream = null; }
    if (recordCtx) { recordCtx.close(); recordCtx = null; }
    recordDest = null;
    mediaRecorder = null;
    recordedChunks = [];
}

async function saveBlob(blob: Blob, opts: RecordingOptions) {
    const ext = blob.type.includes("video") ? "webm" : "ogg";
    const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `AutoCall_${dateStr}.${ext}`;
    
    const native = (window as any).VencordNative?.pluginHelpers?.AutoCallRecorder;

    if (native?.saveRecording && native?.promptSaveRecording) {
        try {
            const arrayBuffer = await blob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            if (!opts.autoSave) {
                const success = await native.promptSaveRecording(uint8Array, filename);
                if (success) {
                    Toasts.show(Toasts.create(t("Save record"), Toasts.Type.SUCCESS));
                }
                return;
            } else if (opts.savePath) {
                const success = await native.saveRecording(uint8Array, opts.savePath, filename);
                if (success) {
                    Toasts.show(Toasts.create(t("Save record"), Toasts.Type.SUCCESS));
                }
                return;
            }
        } catch (e) {
            console.error("Native save failed", e);
        }
    }

    // Fallback standard
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 1000);

    Toasts.show(Toasts.create(t("Save record"), Toasts.Type.SUCCESS));
}
