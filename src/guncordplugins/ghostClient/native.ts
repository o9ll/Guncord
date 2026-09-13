/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, shell, ipcMain } from "electron";
import * as childProcess from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";

try {
    ipcMain.handle("GUNCORD_OPEN_URL", (_event, url: string) => {
        if (typeof url === "string" && url.startsWith("https://")) {
            shell.openExternal(url);
        }
    });
} catch {}

const PORT = 47821;
let serverProc: childProcess.ChildProcess | null = null;
let serverReady = false;
let startPromise: Promise<boolean> | null = null;

// ── Find server/server.js ────────────────────────────────────────────
function findServerScript(): string | null {
    const execDir = path.dirname(process.execPath);
    const resPath = process.resourcesPath;
    let userData = "";
    try { userData = app.getPath("userData"); } catch {}

    const candidates = [
        ...(userData ? [path.join(userData, "server", "server.js")] : []),
        path.join(resPath, "server", "server.js"),
        path.join(execDir, "resources", "server", "server.js"),
        path.join(resPath, "..", "server", "server.js"),
        path.join(execDir, "server", "server.js"),
        path.join(__dirname, "..", "..", "..", "server", "server.js"),
        path.join(__dirname, "..", "..", "..", "..", "server", "server.js"),
        path.join(__dirname, "..", "..", "server", "server.js"),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) { return c; }
    }
    return null;
}

function findNode(): string {
    const execDir = path.dirname(process.execPath);
    const resPath = process.resourcesPath;
    let userData = "";
    try { userData = app.getPath("userData"); } catch {}

    const candidates = [
        ...(userData ? [path.join(userData, "server", "node.exe")] : []),
        path.join(execDir, "node.exe"),
        path.join(resPath, "..", "node.exe"),
        path.join(resPath, "node.exe"),
        path.join(execDir, "resources", "node.exe"),
    ];
    for (const c of candidates) {
        if (fs.existsSync(c)) { return c; }
    }
    return "node";
}

function ping(): Promise<boolean> {
    return new Promise(resolve => {
        const req = http.get(`http://127.0.0.1:${PORT}/status`, res => {
            resolve(res.statusCode === 200);
        });
        req.setTimeout(1500, () => { req.destroy(); resolve(false); });
        req.on("error", () => resolve(false));
    });
}

async function killZombieServer(): Promise<void> {
    try {
        if (await ping()) {
            // Demander l'arrêt propre
            try {
                await new Promise<void>((resolve) => {
                    const req = http.request({ hostname: "127.0.0.1", port: PORT, path: "/shutdown", method: "POST" }, () => resolve());
                    req.setTimeout(800, () => { req.destroy(); resolve(); });
                    req.on("error", () => resolve());
                    req.end();
                });
            } catch { }
            await new Promise(r => setTimeout(r, 400));
            // Si toujours en vie sur Windows, trouver le PID sur le port 47821 et le tuer
            if (process.platform === "win32" && await ping()) {
                try {
                    const out = childProcess.execSync(`netstat -ano | findstr :${PORT}`, { encoding: "utf-8" });
                    for (const line of out.split("\n")) {
                        const parts = line.trim().split(/\s+/);
                        const pid = parts[parts.length - 1];
                        if (pid && !isNaN(Number(pid)) && Number(pid) > 0 && Number(pid) !== process.pid) {
                            childProcess.execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
                        }
                    }
                } catch { }
                await new Promise(r => setTimeout(r, 400));
            }
        }
    } catch { }
}

function syncServerScriptIfOutdated(): void {
    try {
        let userData = "";
        try { userData = app.getPath("userData"); } catch {}
        if (!userData) return;
        const targetPath = path.join(userData, "server", "server.js");

        const execDir = path.dirname(process.execPath);
        const resPath = process.resourcesPath;
        const sources = [
            path.join(__dirname, "..", "..", "..", "server", "server.js"),
            path.join(__dirname, "..", "..", "..", "..", "server", "server.js"),
            path.join(__dirname, "..", "..", "server", "server.js"),
            path.join(resPath, "server", "server.js"),
            path.join(execDir, "resources", "server", "server.js"),
        ];
        for (const src of sources) {
            if (fs.existsSync(src) && src !== targetPath) {
                const srcBuf = fs.readFileSync(src);
                const targetBuf = fs.existsSync(targetPath) ? fs.readFileSync(targetPath) : null;
                if (!targetBuf || !srcBuf.equals(targetBuf)) {
                    fs.writeFileSync(targetPath, srcBuf);
                    console.log(`[GhostNative] Synced updated server.js to ${targetPath}`);
                }
                break;
            }
        }
    } catch (e) {
        console.warn("[GhostNative] syncServerScript error:", e);
    }
}

async function ensureServer(): Promise<boolean> {
    if (serverReady && serverProc && await ping()) return true;
    if (startPromise) return startPromise;

    startPromise = (async () => {
        // Kill zombies before starting
        await killZombieServer();

        // Mettre à jour automatiquement server.js s'il y a une version plus récente
        syncServerScriptIfOutdated();

        const script = findServerScript();
        if (!script) {
            console.error("[GhostNative] server.js not found!");
            startPromise = null;
            return false;
        }

        const nodeExe = findNode();
        const scriptDir = path.dirname(script);
        const nodeModulesPath = path.join(scriptDir, "node_modules");
        console.log(`[GhostNative] Launching: ${nodeExe} ${script}`);
        console.log(`[GhostNative] cwd: ${scriptDir}`);
        console.log(`[GhostNative] node_modules exists: ${fs.existsSync(nodeModulesPath)}`);

        serverProc = childProcess.spawn(nodeExe, [script], {
            windowsHide: true,
            stdio: ["ignore", "pipe", "pipe"],
            detached: false,
            cwd: scriptDir,
            env: {
                ...process.env,
            }
        });

        // Limiter les logs du server dans le main process Electron
        // Trop de logs = I/O sur le thread principal = freezes
        let logBuffer = "";
        serverProc.stdout?.on("data", (d: Buffer) => {
            logBuffer += d.toString();
            const lines = logBuffer.split("\n");
            logBuffer = lines.pop() ?? "";
            for (const line of lines) {
                if (line.trim()) console.log("[GhostServer]", line.trim());
            }
        });
        serverProc.stderr?.on("data", (d: Buffer) => {
            const msg = d.toString().trim();
            if (msg) console.error("[GhostServer ERR]", msg);
        });
        serverProc.on("exit", (code: number | null) => {
            console.log("[GhostNative] server exit:", code);
            serverProc = null;
            serverReady = false;
        });
        serverProc.on("error", (e: Error) => {
            console.error("[GhostNative] spawn error:", e.message);
        });

        // Poll every 200ms for 60s max
        for (let i = 0; i < 300; i++) {
            await new Promise(r => setTimeout(r, 200));
            if (await ping()) {
                console.log("[GhostNative] server ready ✓");
                serverReady = true;
                startPromise = null;
                return true;
            }
        }

        console.error("[GhostNative] server timeout !");
        startPromise = null;
        return false;
    })();

    return startPromise;
}

async function api(endpoint: string, body?: object, timeoutMs = 15000): Promise<any> {
    // FIX: timeout reduced from 90s → 15s.
    // 90s blocked entire Discord UI for nearly 2 minutes if server
    // didn't respond (e.g., yt-dlp running, ffmpeg starting).
    // 15s is plenty for fast calls (/connect, /join, /leave).
    // Slow calls (/stream-start) are now non-blocking on server.js side.
    const ok = await ensureServer();
    if (!ok) return { ok: false, error: "server not found or timeout" };

    return new Promise((resolve, reject) => {
        const data = body !== undefined ? JSON.stringify(body) : undefined;
        const opts: http.RequestOptions = {
            hostname: "127.0.0.1",
            port: PORT,
            path: endpoint,
            method: body !== undefined ? "POST" : "GET",
            headers: {
                "Content-Type": "application/json",
                ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
            },
        };
        const req = http.request(opts, res => {
            let raw = "";
            res.on("data", c => raw += c);
            res.on("end", () => {
                try { resolve(JSON.parse(raw)); }
                catch { resolve({ ok: false, error: "Invalid JSON" }); }
            });
        });
        // FIX: 15s timeout instead of 90s — avoids freezing Discord UI
        req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error(`Timeout ${timeoutMs / 1000}s`)); });
        req.on("error", reject);
        if (data) req.write(data);
        req.end();
    });
}

export async function listAudioInputDevices(_: any): Promise<{ label: string; dshowName: string; }[]> {
    // FIX: try server FIRST (fast, < 1s if available).
    // Before this fix, if server wasn't ready, we spawned ffmpeg directly
    // on Electron main process with an 8s timeout — freezing Discord UI
    // for 8 seconds and explaining the "long loading" on screen selector.
    // Now: server in 1s → ffmpeg fallback in 5s max (reduced from 8s).
    try {
        const ok = await Promise.race([
            ping(),
            new Promise<boolean>(r => setTimeout(() => r(false), 1000))
        ]);
        if (ok) {
            const res = await api("/devices", undefined, 3000);
            if (res?.devices?.length) {
                const names: string[] = res.devices;
                return names.map((n: string) => ({ label: n, dshowName: n }));
            }
        }
    } catch { }

    // Direct ffmpeg fallback — timeout reduced to 5s (instead of 8s)
    return new Promise(resolve => {
        let userData = "";
        try { userData = app.getPath("userData"); } catch {}
        const ghostServerNodeModules = userData
            ? path.join(userData, "server", "node_modules")
            : path.join(process.resourcesPath ?? "", "server", "node_modules");

        const ffmpegCandidates = [
            ...(userData ? [
                path.join(userData, "server", "ffmpeg.exe"),
                path.join(userData, "server", "node_modules", "node-av", "binary", "ffmpeg.exe"),
            ] : []),
            path.join(path.dirname(process.execPath), "ffmpeg.exe"),
            path.join(process.resourcesPath ?? "", "..", "ffmpeg.exe"),
            // Bundled via node-av in server/node_modules (already in installer)
            path.join(ghostServerNodeModules, "node-av", "binary", "ffmpeg.exe"),
            path.join(ghostServerNodeModules, "node_modules", "node-av", "binary", "ffmpeg.exe"),
            "ffmpeg",
        ];
        let ffmpeg = "ffmpeg";
        for (const c of ffmpegCandidates) {
            if (c !== "ffmpeg" && fs.existsSync(c)) { ffmpeg = c; break; }
        }

        try {
            const proc = childProcess.spawn(ffmpeg, [
                "-list_devices", "true", "-f", "dshow", "-i", "dummy", "-hide_banner"
            ], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

            const chunks: Buffer[] = [];
            proc.stderr?.on("data", (d: Buffer) => chunks.push(d));
            proc.stdout?.on("data", (d: Buffer) => chunks.push(d));

            proc.on("exit", () => {
                // Decode UTF-8, fallback latin1 if replacement characters
                // (Windows ffmpeg uses system codepage, not UTF-8)
                const raw = Buffer.concat(chunks);
                let out = raw.toString("utf8");
                if (out.includes("\ufffd")) out = raw.toString("latin1");
                const names: string[] = [];
                for (const line of out.split(/\r?\n/)) {
                    if (!/\(audio\)/i.test(line) || /Alternative name/i.test(line)) continue;
                    const m = line.match(/"([^"]+)"/);
                    if (!m) continue;
                    const name = m[1].trim();
                    if (!name.startsWith("@") && name.length >= 2 && !names.includes(name))
                        names.push(name);
                }
                resolve(names.map((n: string) => ({ label: n, dshowName: n })));
            });

            proc.on("error", () => resolve([]));
            // FIX: timeout reduced to 5s (instead of 8s) — reduces UI freeze by 37%
            setTimeout(() => { try { proc.kill(); } catch { } resolve([]); }, 5000);
        } catch { resolve([]); }
    });
}

export async function connectGhost(
    _: any, userId: string, token: string, guildId: string, channelId: string, micDevice: string,
): Promise<{ ok: boolean; error?: string; }> {
    // server awaits DVS internally (up to 60s) + login (20s) + joinVoice
    // 120s HTTP timeout to cover worst case without stacking waitForDVS
    try { return await api("/connect", { userId, token, guildId, channelId, micDevice }, 120000); }
    catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
}

export async function preConnectGhost(
    _: any, userId: string, token: string, micDevice: string,
): Promise<{ ok: boolean; error?: string; }> {
    try { return await api("/preconnect", { userId, token, micDevice }, 120000); }
    catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
}

export async function joinVoice(
    _: any, userId: string, guildId: string, channelId: string, micDevice: string,
): Promise<{ ok: boolean; error?: string; }> {
    try { return await api("/join", { userId, guildId, channelId, micDevice }); }
    catch (e: any) { return { ok: false, error: e?.message ?? String(e) }; }
}

export async function joinVoiceAll(
    _: any, userIds: string[], guildId: string, channelId: string, micDevice: string,
): Promise<{ ok: boolean; }> {
    try { await api("/join-all", { userIds, guildId, channelId, micDevice }); return { ok: true }; }
    catch { return { ok: false }; }
}

export async function leaveVoiceAll(_: any, userIds: string[]): Promise<void> {
    try { await api("/leave-all", { userIds }); } catch { }
}

export async function leaveVoice(_: any, userId: string): Promise<void> {
    try { await api("/leave", { userId }); } catch { }
}

export async function disconnectGhost(_: any, userId: string): Promise<void> {
    try { await api("/disconnect", { userId }); } catch { }
}

export async function setMicDevice(_: any, micDevice: string): Promise<void> {
    try { await api("/set-mic", { micDevice }); } catch { }
}

export async function fakeMute(_: any, userIds: string[], muted: boolean): Promise<void> {
    try { await api("/fake-mute", { userIds, muted }); } catch { }
}

export async function fakeDeafen(_: any, userIds: string[], deafened: boolean): Promise<void> {
    try { await api("/fake-deafen", { userIds, deafened }); } catch { }
}

export async function fakeStream(_: any, userIds: string[], streaming: boolean): Promise<void> {
    try { await api("/fake-stream", { userIds, streaming }); } catch { }
}

export async function fakeCam(_: any, userIds: string[], camera: boolean): Promise<void> {
    try { await api("/fake-cam", { userIds, camera }); } catch { }
}

export async function init(_: any): Promise<void> {
    const script = findServerScript();
    console.log("[GhostNative] init — server.js:", script ?? "NOT FOUND");
    console.log("[GhostNative] node exe:", findNode());

    const ok = await ensureServer();
    if (!ok) {
        console.error("[GhostNative] server failed");
        return;
    }
    console.log("[GhostNative] server HTTP prêt ✓");
}

export async function isServerOnline(_: any): Promise<boolean> {
    return await ping();
}

export async function isServerInstalled(_: any): Promise<boolean> {
    return findServerScript() !== null;
}

// ── Cleanup ───────────────────────────────────────────────────────────────────
app.on("before-quit", () => {
    if (serverProc) {
        try { serverProc.kill(); } catch { }
        serverProc = null;
    }
});
