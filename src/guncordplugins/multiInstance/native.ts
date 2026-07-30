/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { app, BrowserWindow, ipcMain,screen, session } from "electron";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { join } from "path";

import { registerMediaPermissionsForSession } from "../../guncord/main/mediaPermissions";

const openWindows = new Map<string, BrowserWindow>();

// ─────────────────────────────────────────────────────────────────────────────
// Shared settings (theme, audio, zoom, etc.) between all instances
//
// Each instance runs in its own Electron session (persist:guncord-mi-{userId}),
// so its localStorage is completely empty on first launch: Discord starts
// with default settings (no audio device chosen, default theme, etc.),
// giving the impression of an "empty" window until the user reconfigures everything
// manually.
//
// We therefore capture the localStorage of the window triggering the opening (most
// often the main window) and save it to disk. This cache is then
// injected into each new instance via preload, but ONLY for keys
// that don't exist yet in the target profile — we never touch an already
// customized setting to break nothing.
// ─────────────────────────────────────────────────────────────────────────────

const SHARED_SETTINGS_FILE = join(app.getPath("userData"), "guncord-mi-shared-settings.json");

// Keys we never want to copy from one window to another (account identity)
const SHARED_SETTINGS_BLOCKLIST = new Set(["token"]);

const DUMP_LOCAL_STORAGE_SCRIPT = `
(function() {
    try {
        const out = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || k === "token") continue;
            out[k] = localStorage.getItem(k);
        }
        return JSON.stringify(out);
    } catch (e) {
        return "{}";
    }
})();
`;

function loadSharedSettings(): Record<string, string> {
    try {
        if (!existsSync(SHARED_SETTINGS_FILE)) return {};
        const raw = readFileSync(SHARED_SETTINGS_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function saveSharedSettings(settings: Record<string, string>): void {
    try {
        writeFileSync(SHARED_SETTINGS_FILE, JSON.stringify(settings), "utf-8");
    } catch (e) {
        console.warn("[GuncordMI] Failed to save shared settings:", e);
    }
}

/**
 * Captures localStorage of the window that triggered the action (event.sender)
 * and merges it with cache already present on disk. Never throws an error:
 * in case of trouble we simply fall back to existing cache.
 */
async function captureAndMergeSharedSettings(sourceEvent: any): Promise<Record<string, string>> {
    const existing = loadSharedSettings();
    try {
        const sourceWc = sourceEvent?.sender;
        if (!sourceWc || sourceWc.isDestroyed?.()) return existing;
        const dump = await sourceWc.executeJavaScript(DUMP_LOCAL_STORAGE_SCRIPT);
        const captured = JSON.parse(dump || "{}");
        const filtered: Record<string, string> = {};
        for (const [key, value] of Object.entries(captured)) {
            if (SHARED_SETTINGS_BLOCKLIST.has(key)) continue;
            if (typeof value === "string") filtered[key] = value;
        }
        const merged = { ...existing, ...filtered };
        saveSharedSettings(merged);
        return merged;
    } catch {
        return existing;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Intercept window control IPC for multi-instance.
//
// Native Discord uses ipcMain.handle("DISCORD_WINDOW_CLOSE" | "DISCORD_WINDOW_MINIMIZE" | ...)
// These handlers are registered GLOBALLY by Discord on ipcMain, so they
// catch all events from all windows and call injectedGetWindow(key)
// which always returns the main window.
//
// To bypass this, we use webContents.ipc.handle on the webContents
// of each multi-instance window — these handlers are LOCAL to this webContents
// and take priority over global ipcMain handlers for this sender.
// ─────────────────────────────────────────────────────────────────────────────

function registerWindowControlIpc(win: BrowserWindow): () => void {
    const wc = win.webContents as any; // webContents.ipc exists since Electron 20

    // Native Discord channels (discovered in _core_extracted/bundle.js)
    const CLOSE = "DISCORD_WINDOW_CLOSE";
    const MINIMIZE = "DISCORD_WINDOW_MINIMIZE";
    const MAXIMIZE = "DISCORD_WINDOW_MAXIMIZE";
    const RESTORE = "DISCORD_WINDOW_RESTORE";
    const FULLSCREEN = "DISCORD_WINDOW_TOGGLE_FULLSCREEN";

    // webContents.ipc.handle takes priority over ipcMain.handle for this sender
    const handleClose = () => { if (!win.isDestroyed()) win.close(); };
    const handleMinimize = () => { if (!win.isDestroyed()) win.minimize(); };
    const handleMaximize = () => {
        if (win.isDestroyed()) return;
        if (win.isMaximized()) win.unmaximize(); else win.maximize();
    };
    const handleRestore = () => { if (!win.isDestroyed()) win.restore(); };
    const handleFullscreen = () => { if (!win.isDestroyed()) win.setFullScreen(!win.isFullScreen()); };

    try {
        // webContents.ipc.handle (Electron 20+)
        wc.ipc.handle(CLOSE, handleClose);
        wc.ipc.handle(MINIMIZE, handleMinimize);
        wc.ipc.handle(MAXIMIZE, handleMaximize);
        wc.ipc.handle(RESTORE, handleRestore);
        wc.ipc.handle(FULLSCREEN, handleFullscreen);
    } catch {
        // Fallback: global ipcMain.handle with sender filter
        // (less clean but works on Electron < 20)
        //
        // IMPORTANT: DISCORD_WINDOW_TOGGLE_FULLSCREEN is already registered globally
        // by main patcher. We do NOT re-register it here to avoid
        // "Attempted to register a second handler" crashing Discord on startup.
        const guardedHandle = (fn: () => void) => (event: Electron.IpcMainInvokeEvent) => {
            if (BrowserWindow.fromWebContents(event.sender) !== win) return;
            fn();
        };
        // removeHandler first to avoid crash on double call
        ipcMain.removeHandler(CLOSE);
        ipcMain.removeHandler(MINIMIZE);
        ipcMain.removeHandler(MAXIMIZE);
        ipcMain.removeHandler(RESTORE);
        // DO NOT register FULLSCREEN - handled globally by patcher
        ipcMain.handle(CLOSE, guardedHandle(handleClose));
        ipcMain.handle(MINIMIZE, guardedHandle(handleMinimize));
        ipcMain.handle(MAXIMIZE, guardedHandle(handleMaximize));
        ipcMain.handle(RESTORE, guardedHandle(handleRestore));
        return () => {
            ipcMain.removeHandler(CLOSE);
            ipcMain.removeHandler(MINIMIZE);
            ipcMain.removeHandler(MAXIMIZE);
            ipcMain.removeHandler(RESTORE);
        };
    }

    // Return cleanup for webContents.ipc
    return () => {
        try {
            wc.ipc.removeHandler(CLOSE);
            wc.ipc.removeHandler(MINIMIZE);
            wc.ipc.removeHandler(MAXIMIZE);
            wc.ipc.removeHandler(RESTORE);
            wc.ipc.removeHandler(FULLSCREEN);
        } catch { }
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Create token preload script
// ─────────────────────────────────────────────────────────────────────────────

function createTokenPreload(token: string, sharedSettings: Record<string, string> = {}): string {
    // Temporary directory in userData
    const dir = join(app.getPath("userData"), "guncord-mi-preloads");
    mkdirSync(dir, { recursive: true });

    const safeToken = JSON.stringify(token); // safely escape token
    const safeSharedSettings = JSON.stringify(sharedSettings ?? {});

    const script = `
// Guncord MultiInstance — token preload
// Runs in main world BEFORE Discord
(function() {
    const TOKEN = ${safeToken};
    const SHARED_SETTINGS = ${safeSharedSettings};
    try {
        // Pre-fills shared visual/audio settings (theme, audio device, zoom, ...)
        // ONLY if key does not already exist in this profile, to never overwrite
        // an already customized setting for this specific instance.
        try {
            for (const key in SHARED_SETTINGS) {
                if (key === "token") continue;
                if (localStorage.getItem(key) === null) {
                    localStorage.setItem(key, SHARED_SETTINGS[key]);
                }
            }
        } catch (e) {
            console.warn("[GuncordMI] Shared settings seed error:", e);
        }

        // Set token in localStorage
        Object.defineProperty(window, '__guncord_token', { value: TOKEN, writable: false });

        // Patch localStorage.getItem to always return token if requested
        const _origGetItem = Storage.prototype.getItem;
        const _origSetItem = Storage.prototype.setItem;

        Storage.prototype.getItem = function(key) {
            if (this === localStorage && key === "token") {
                return JSON.stringify(TOKEN);
            }
            return _origGetItem.call(this, key);
        };

        // Pre-fill as well
        try { localStorage.setItem("token", JSON.stringify(TOKEN)); } catch(_) {}

        console.log("[GuncordMI] Token preload active ✓");
    } catch(e) {
        console.warn("[GuncordMI] Preload error:", e);
    }
})();
`;

    const filePath = join(dir, `token-preload-${Date.now()}.js`);
    writeFileSync(filePath, script, "utf-8");
    return filePath;
}

// ─────────────────────────────────────────────────────────────────────────────
// Open a new isolated Discord window
// ─────────────────────────────────────────────────────────────────────────────

// Compteur d'icones detached : tourne de 1 a 5
let iconCounter = 1;

// Chemin vers le dossier d'icones detached (multi-instance-icons/ dans le dist)
function getDetachedIconDir(): string {
    // En production : {app_dir}/multi-instance-icons/
    // En dev : Desktop/lolll/
    const exeDir = join(process.execPath, "..");
    const prodDir = join(exeDir, "multi-instance-icons");
    if (existsSync(prodDir)) return prodDir;
    // Fallback dev : Desktop/lolll
    const desktopDir = join(app.getPath("desktop"), "lolll");
    if (existsSync(desktopDir)) return desktopDir;
    return prodDir;
}

export async function openInstanceWindow(
    _: any,
    token: string,
    userId: string,
    detached = false,
    username = ""
): Promise<{ ok: boolean; error?: string; }> {
    try {
        // Fenetre deja ouverte -> focus
        const existing = openWindows.get(userId);
        if (existing && !existing.isDestroyed()) {
            existing.show();
            existing.focus();
            return { ok: true };
        }

        // ID unique par instance - Windows groupe les fenetres par AppUserModelId
        // En donnant un ID different a chaque fenetre, elles ne se regroupent pas
        const uniqueAppId = `guncord.instance.${userId}.${Date.now()}`;

        // Icone : rotation 1→2→3→4→5→1→... depuis multi-instance-icons/
        let currentIconPath = "";
        const iconDir = getDetachedIconDir();
        currentIconPath = join(iconDir, `${iconCounter}.ico`);
        if (!existsSync(currentIconPath)) currentIconPath = "";
        iconCounter = iconCounter >= 5 ? 1 : iconCounter + 1;

        // Session Electron isolee par userId
        const partition = `persist:guncord-mi-${userId}`;
        const ses = session.fromPartition(partition, { cache: true });

        ses.webRequest.onHeadersReceived((details, callback) => {
            const headers = { ...details.responseHeaders };
            for (const key of Object.keys(headers)) {
                const low = key.toLowerCase();
                if (low === "content-security-policy" || low === "permissions-policy" || low === "feature-policy") {
                    delete headers[key];
                }
            }
            callback({ responseHeaders: headers });
        });

        registerMediaPermissionsForSession(ses);

        const sharedSettings = await captureAndMergeSharedSettings(_);
        const preloadPath = createTokenPreload(token, sharedSettings);
        ses.setPreloads([preloadPath]);

        const win = new BrowserWindow({
            width: 1280,
            height: 800,
            minWidth: 940,
            minHeight: 500,
            parent: undefined,
            skipTaskbar: false,
            frame: false,
            transparent: false,
            titleBarStyle: "hidden",
            autoHideMenuBar: true,
            darkTheme: true,
            backgroundColor: "#313338",
            title: `Guncord [${username || userId}]`,
            icon: currentIconPath || undefined,
            webPreferences: {
                preload: join(__dirname, "preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
                session: ses,
                webSecurity: false,
            },
        });

        // CRITIQUE : setAppDetails DOIT etre appele immediatement apres new BrowserWindow,
        // avant que la fenetre soit affichee. C'est ce qui empeche Windows de grouper
        // les fenetres ensemble dans la barre des taches.
        if (process.platform === "win32") {
            try {
                win.setAppDetails({
                    appId: uniqueAppId,
                    appIconPath: currentIconPath || undefined,
                    relaunchDisplayName: `Guncord [${username || userId}]`,
                });
            } catch (err) {
                console.warn("[GuncordMI] setAppDetails failed:", err);
            }
        }

        openWindows.set(userId, win);

        win.on("enter-html-full-screen", () => {
            win.setFullScreen(true);
        });
        win.on("leave-html-full-screen", () => {
            win.setFullScreen(false);
        });

        // Before closing: unregister service workers and cut gateway
        // to stop all push notifications
        win.on("close", () => {
            wc.executeJavaScript(`
                (async () => {
                    try {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (const r of regs) await r.unregister();
                    } catch(e) {}
                    try {
                        // Cut Discord gateway connection
                        const ws = window.__GUNCORD_GW_WS__;
                        if (ws && ws.readyState <= 1) ws.close(4000, 'window_close');
                    } catch(e) {}
                })();
            `).catch(() => {});
        });

        // Register window control IPC handlers (DISCORD_WINDOW_*) on this webContents
        // Must be done BEFORE Discord loads its JS (dom-ready)
        const wc = win.webContents;
        const cleanupIpc = registerWindowControlIpc(win);

        win.once("closed", () => {
            cleanupIpc();
            openWindows.delete(userId);
            // Clean session service workers to permanently cut notifications
            ses.clearStorageData({ storages: ["serviceworkers"] }).catch(() => {});
            // Delete temporary preload file to prevent accumulation on disk
            try { unlinkSync(preloadPath); } catch {}
        });

        // Flash quand il y a des notifs
        wc.on("page-title-updated", (e, title) => {
            if (process.platform === "win32") {
                if (/^\(\d+\)/.test(title)) win.flashFrame(true);
                else win.flashFrame(false);
            }
        });

        // Injection du token
        const safeToken = JSON.stringify(token);
        const injectJs = `(function(){ try { localStorage.setItem("token", ${safeToken}); } catch(e) {} })();`;
        wc.on("dom-ready", () => wc.executeJavaScript(injectJs).catch(() => { }));
        wc.on("did-finish-load", () => wc.executeJavaScript(injectJs).catch(() => { }));
        wc.on("did-navigate", () => wc.executeJavaScript(injectJs).catch(() => { }));

        // Titre de la fenetre
        wc.on("page-title-updated", (e, title) => {
            const cleanTitle = title.replace(/^\(\d+\)\s*/, "").replace(/\s*\[.*\]$/, "");
            win.setTitle(`${cleanTitle} [${username || userId}]`);
            e.preventDefault();
        });

        wc.on("will-navigate", (e, url) => {
            if (!/^https:\/\/(ptb\.|canary\.)?discord\.com/.test(url)) e.preventDefault();
        });

        wc.setWindowOpenHandler(({ url }) => {
            if (url.startsWith("http")) require("electron").shell.openExternal(url);
            return { action: "deny" };
        });

        await win.loadURL("https://discord.com/channels/@me");
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// « Grouped » windows — same group as Guncord in taskbar
// Principle: do NOT touch setAppDetails => window inherits AppId
// of main process (com.guncord.app), Windows groups it automatically
// ─────────────────────────────────────────────────────────────────────────────

const openGroupedWindows = new Map<string, BrowserWindow>();

export async function openInstanceWindowGrouped(
    _: any,
    token: string,
    userId: string,
    username = ""
): Promise<{ ok: boolean; error?: string; }> {
    try {
        // Focus si deja ouverte
        const existing = openGroupedWindows.get(userId);
        if (existing && !existing.isDestroyed()) {
            existing.show();
            existing.focus();
            return { ok: true };
        }

        // Session isolee par userId
        const partition = `persist:guncord-mi-${userId}`;
        const ses = session.fromPartition(partition, { cache: true });

        ses.webRequest.onHeadersReceived((details, callback) => {
            const headers = { ...details.responseHeaders };
            for (const key of Object.keys(headers)) {
                const low = key.toLowerCase();
                if (low === "content-security-policy" || low === "permissions-policy" || low === "feature-policy") {
                    delete headers[key];
                }
            }
            callback({ responseHeaders: headers });
        });

        registerMediaPermissionsForSession(ses);

        const sharedSettings = await captureAndMergeSharedSettings(_);
        const preloadPath = createTokenPreload(token, sharedSettings);
        ses.setPreloads([preloadPath]);

        const win = new BrowserWindow({
            width: 1280,
            height: 800,
            minWidth: 940,
            minHeight: 500,
            parent: undefined,
            skipTaskbar: false,
            frame: false,
            transparent: false,
            titleBarStyle: "hidden",
            autoHideMenuBar: true,
            darkTheme: true,
            backgroundColor: "#313338",
            title: `Guncord [${username || userId}]`,
            webPreferences: {
                preload: join(__dirname, "preload.js"),
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
                session: ses,
                webSecurity: false,
            },
        });

        openGroupedWindows.set(userId, win);

        win.on("enter-html-full-screen", () => {
            win.setFullScreen(true);
        });
        win.on("leave-html-full-screen", () => {
            win.setFullScreen(false);
        });

        // Before closing: unregister service workers and cut gateway
        win.on("close", () => {
            wc.executeJavaScript(`
                (async () => {
                    try {
                        const regs = await navigator.serviceWorker.getRegistrations();
                        for (const r of regs) await r.unregister();
                    } catch(e) {}
                    try {
                        const ws = window.__GUNCORD_GW_WS__;
                        if (ws && ws.readyState <= 1) ws.close(4000, 'window_close');
                    } catch(e) {}
                })();
            `).catch(() => {});
        });

        // Register window control IPC handlers for this grouped instance
        const wc = win.webContents;
        const cleanupIpc = registerWindowControlIpc(win);

        win.once("closed", () => {
            cleanupIpc();
            openGroupedWindows.delete(userId);
            ses.clearStorageData({ storages: ["serviceworkers"] }).catch(() => {});
            try { unlinkSync(preloadPath); } catch {}
        });

        wc.on("page-title-updated", (e, title) => {
            if (process.platform === "win32") {
                if (/^\(\d+\)/.test(title)) win.flashFrame(true);
                else win.flashFrame(false);
            }
        });

        const safeToken = JSON.stringify(token);
        const injectJs = `(function(){ try { localStorage.setItem("token", ${safeToken}); } catch(e) {} })();`;
        wc.on("dom-ready", () => wc.executeJavaScript(injectJs).catch(() => {}));
        wc.on("did-finish-load", () => wc.executeJavaScript(injectJs).catch(() => {}));
        wc.on("did-navigate", () => wc.executeJavaScript(injectJs).catch(() => {}));

        wc.on("page-title-updated", (e, title) => {
            const cleanTitle = title.replace(/^\(\d+\)\s*/, "").replace(/\s*\[.*\]$/, "");
            win.setTitle(`${cleanTitle} [${username || userId}]`);
            e.preventDefault();
        });

        wc.on("will-navigate", (e, url) => {
            if (!/^https:\/\/(ptb\.|canary\.)?discord\.com/.test(url)) e.preventDefault();
        });

        wc.setWindowOpenHandler(({ url }) => {
            if (url.startsWith("http")) require("electron").shell.openExternal(url);
            return { action: "deny" };
        });

        await win.loadURL("https://discord.com/channels/@me");
        return { ok: true };
    } catch (e: any) {
        return { ok: false, error: e?.message ?? String(e) };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Split screen: position both windows side by side
// ─────────────────────────────────────────────────────────────────────────────

export async function arrangeSplit(_: any, userId: string): Promise<void> {
    try {
        const secondWin = openWindows.get(userId);
        if (!secondWin || secondWin.isDestroyed()) return;

        const allWins = BrowserWindow.getAllWindows();
        const mainWin = allWins.find(w => w !== secondWin && !w.isDestroyed());
        if (!mainWin) return;

        const display = screen.getDisplayMatching(mainWin.getBounds());
        const { x, y, width, height } = display.workArea;
        const half = Math.floor(width / 2);

        mainWin.setBounds({ x, y, width: half, height }, true);
        secondWin.setBounds({ x: x + half, y, width: width - half, height }, true);
        secondWin.show();
        secondWin.focus();
    } catch (e) {
        console.error("[GuncordMI] arrangeSplit error:", e);
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Liste / ferme les instances
// ─────────────────────────────────────────────────────────────────────────────

export async function getOpenInstances(_: any): Promise<string[]> {
    return [...openWindows.entries()]
        .filter(([, w]) => !w.isDestroyed())
        .map(([id]) => id);
}

export async function closeInstance(_: any, userId: string): Promise<void> {
    const win = openWindows.get(userId);
    if (win && !win.isDestroyed()) win.close();
}

