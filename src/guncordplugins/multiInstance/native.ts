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

// Keys we never want to copy from one window to another (account identity / session)
const SHARED_SETTINGS_BLOCKLIST = new Set([
    "token",
    "default_token",
    "multiaccount_tokens",
    "tokens",
    "user_id_cache",
    "MultiAccountStore",
    "AuthenticationStore",
    "UserProfileStore",
    "UserStore",
    "login_token",
    "email_cache"
]);

const DUMP_LOCAL_STORAGE_SCRIPT = `
(function() {
    try {
        const block = ["token", "default_token", "multiaccount_tokens", "tokens", "user_id_cache", "MultiAccountStore", "AuthenticationStore", "login_token"];
        const out = {};
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || block.includes(k)) continue;
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

let isAppQuitting = false;
app.on("before-quit", () => {
    isAppQuitting = true;
});

function registerWindowControlIpc(win: BrowserWindow): () => void {
    const wc = win.webContents as any; // webContents.ipc exists since Electron 20

    // Native Discord channels (discovered in _core_extracted/bundle.js)
    const CLOSE = "DISCORD_WINDOW_CLOSE";
    const MINIMIZE = "DISCORD_WINDOW_MINIMIZE";
    const MAXIMIZE = "DISCORD_WINDOW_MAXIMIZE";
    const RESTORE = "DISCORD_WINDOW_RESTORE";
    const FULLSCREEN = "DISCORD_WINDOW_TOGGLE_FULLSCREEN";

    // webContents.ipc.handle est prioritaire sur ipcMain.handle pour ce sender
    const handleClose = () => {
        if (!win.isDestroyed()) {
            (win as any)._userRequestedClose = true;
            win.close();
        }
    };
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
// Intercepts Discord badge/notification IPCs for a multi-instance.
//
// Native Discord emits DISCORD_SET_BADGE_COUNT (and other badge channels) via
// ipcRenderer → ipcMain globally. Discord's global handler calls
// injectedGetWindow(), which always returns the main window. As a result,
// the red badge (ping) is displayed on the main Discord icon, never on
// the multi-instance window icon.
//
// We override these channels on the local webContents of each instance (via
// webContents.ipc.on) to intercept messages before they reach
// the global handler, and we apply flashFrame + setOverlayIcon directly
// on the correct BrowserWindow.
// ─────────────────────────────────────────────────────────────────────────────
import { setBadgeCount } from "../../guncord/main/appBadge";
// IPC channels known for managing Discord badges/notifications
const BADGE_IPC_CHANNELS = [
    "DISCORD_SET_BADGE_COUNT",
    "SET_BADGE_COUNT",
    "DISCORD_APP_BADGE",
    "APP_BADGE",
    "BADGE_COUNT",
    "DISCORD_BADGE_COUNT",
    "VCD_SET_BADGE_COUNT"
];
const NOTIFICATION_IPC_CHANNELS = [
    "DISCORD_NOTIFICATION",
    "SEND_NOTIFICATION",
    "DISPATCH_NOTIFICATION",
    "FLASH_FRAME"
];
function registerNotificationIpc(win: BrowserWindow): () => void {
    if (win.isDestroyed()) return () => {};
    const wc = win.webContents as any;
    const cleanups: Array<() => void> = [];
    // ── Badge count handler ──────────────────────────────────────────────────
    const handleBadge = (_event: any, count?: number) => {
        if (win.isDestroyed()) return;
        try {
            const n = typeof count === "number" ? count : 0;
            setBadgeCount(n, win);
            if (process.platform === "win32") {
                win.flashFrame(n > 0);
            }
        } catch { }
    };
    // ── Notification handler ─────────────────────────────────────────────────
    const handleNotification = (_event: any) => {
        if (win.isDestroyed()) return;
        try {
            if (process.platform === "win32") {
                win.flashFrame(true);
            }
        } catch { }
    };
    // Use webContents.ipc.on (this sender takes precedence over ipcMain)
    try {
        for (const channel of BADGE_IPC_CHANNELS) {
            wc.ipc.on(channel, handleBadge);
            cleanups.push(() => { try { wc.ipc.removeListener(channel, handleBadge); } catch { } });
        }
        for (const channel of NOTIFICATION_IPC_CHANNELS) {
            wc.ipc.on(channel, handleNotification);
            cleanups.push(() => { try { wc.ipc.removeListener(channel, handleNotification); } catch { } });
        }
    } catch {
        // Fallback Electron <20: ipcMain with filter by sender
        const guardedBadge = (event: Electron.IpcMainEvent, count?: number) => {
            const senderWin = BrowserWindow.fromWebContents(event.sender);
            if (senderWin !== win) return;
            handleBadge(event, count);
            // Prevents propagation to Discord's global handler
            event.returnValue = undefined;
        };
        const guardedNotif = (event: Electron.IpcMainEvent) => {
            const senderWin = BrowserWindow.fromWebContents(event.sender);
            if (senderWin !== win) return;
            handleNotification(event);
        };
        for (const channel of BADGE_IPC_CHANNELS) {
            ipcMain.on(channel, guardedBadge);
            cleanups.push(() => ipcMain.removeListener(channel, guardedBadge));
        }
        for (const channel of NOTIFICATION_IPC_CHANNELS) {
            ipcMain.on(channel, guardedNotif);
            cleanups.push(() => ipcMain.removeListener(channel, guardedNotif));
        }
    }
    return () => { for (const fn of cleanups) fn(); };
}

// ─────────────────────────────────────────────────────────────────────────────
// Create token preload script
// ─────────────────────────────────────────────────────────────────────────────

function createTokenPreload(token: string, sharedSettings: Record<string, string> = {}): string {
    const dir = join(app.getPath("userData"), "guncord-mi-preloads");
    mkdirSync(dir, { recursive: true });

    const cleanToken = String(token || "").trim().replace(/^"+|"+$/g, "");

    // Serialize values to JS string literals safe to embed via JSON.stringify
    const tokenLiteral = JSON.stringify(cleanToken);
    const settingsLiteral = JSON.stringify(JSON.stringify(sharedSettings ?? {}));

    // Inner script: runs in main world via webFrame.executeJavaScript.
    // Must be plain JavaScript — no TypeScript syntax, no template literals.
    const innerLines = [
        "(function() {",
        "  var RAW_TOKEN = " + tokenLiteral + ";",
        "  var SETTINGS_JSON = " + settingsLiteral + ";",
        "  var CONFLICT = ['token','default_token','multiaccount_tokens','tokens','user_id_cache','MultiAccountStore','AuthenticationStore','login_token'];",
        "  try { localStorage.removeItem('multiaccount_tokens'); localStorage.removeItem('user_id_cache'); } catch(e) {}",
        "  try {",
        "    var sh = JSON.parse(SETTINGS_JSON || '{}');",
        "    for (var k in sh) { if (CONFLICT.indexOf(k) >= 0) continue; if (localStorage.getItem(k) === null) localStorage.setItem(k, sh[k]); }",
        "  } catch(e) {}",
        "  if (RAW_TOKEN && RAW_TOKEN !== 'undefined') {",
        "    var qt = JSON.stringify(RAW_TOKEN);",
        "    try { localStorage.setItem('token', qt); } catch(e) {}",
        "    try { localStorage.setItem('default_token', qt); } catch(e) {}",
        "    try {",
        "      if ((location.pathname.indexOf('/login') >= 0 || location.pathname === '/') && !window.__mi_redirected) {",
        "        window.__mi_redirected = true;",
        "        location.href = 'https://discord.com/channels/@me';",
        "      }",
        "    } catch(e) {}",
        "  }",
        "  try { Object.defineProperty(window, '__guncord_token', { value: RAW_TOKEN, writable: false, configurable: true }); } catch(e) {}",
        "  (function() {",
        "    var lastUI = 0;",
        "    window.addEventListener('pointerdown', function(e) { if (e.isTrusted) lastUI = Date.now(); }, true);",
        "    window.addEventListener('keydown', function(e) { if (e.isTrusted) lastUI = Date.now(); }, true);",
        "    function patchClose() {",
        "      var dn = window.DiscordNative;",
        "      if (dn && dn.window && dn.window.close && !dn.window._miPatched) {",
        "        var orig = dn.window.close;",
        "        dn.window.close = function() { if (Date.now() - lastUI < 2000) orig.apply(this, arguments); };",
        "        dn.window._miPatched = true;",
        "      }",
        "    }",
        "    patchClose();",
        "    document.addEventListener('DOMContentLoaded', patchClose);",
        "    setInterval(patchClose, 1000);",
        "  })();",
        "  console.log('[GuncordMI] token preload active');",
        "})();"
    ].join("\n");

    // The preload file runs in the isolated Node/Electron world.
    // innerLines is embedded as a JSON string literal so it is never misinterpreted.
    const innerLiteralForNode = JSON.stringify(innerLines);

    const script = [
        "// Guncord MultiInstance — token preload",
        "(function() {",
        "  try {",
        "    var wf = null;",
        "    try { wf = require('electron').webFrame; } catch(e) {}",
        "    if (!wf) { try { wf = require('electron/renderer').webFrame; } catch(e) {} }",
        "    if (wf) {",
        "      wf.executeJavaScript(" + innerLiteralForNode + ")",
        "        .catch(function(err) { console.warn('[GuncordMI] mainWorld error:', err); });",
        "    }",
        "  } catch(e) { console.warn('[GuncordMI] preload error:', e); }",
        "})();"
    ].join("\n");

    const filePath = join(dir, "token-preload-" + Date.now() + ".js");
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
    username = "",
    domain = "discord.com",
    blockExternalTokenAccess = false,
    performanceMode = false
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
        const savedPartition = `persist:guncord-mi-${userId}`;
        if (blockExternalTokenAccess) {
            try {
                const savedSes = session.fromPartition(savedPartition, { cache: true });
                await savedSes.clearStorageData();
                await savedSes.clearCache();
            } catch {}
        }

        const partition = blockExternalTokenAccess
            ? `guncord-mi-${userId}-${Date.now()}`
            : savedPartition;
        const ses = session.fromPartition(partition, { cache: !blockExternalTokenAccess });

        ses.webRequest.onBeforeRequest({ urls: ["*://*.discord.com/handoff*", "*://discord.com/handoff*"] }, (details, callback) => {
            callback({ cancel: true });
        });

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
                backgroundThrottling: performanceMode,
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
        // Redirects badge/notification IPCs to THIS window (not the main window)
        const cleanupNotifIpc = registerNotificationIpc(win);

        win.once("closed", () => {
            cleanupIpc();
            cleanupNotifIpc();
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
        const cleanTok = String(token || "").trim().replace(/^"+|"+$/g, "");
        const safeTokenStr = JSON.stringify(cleanTok);
        const injectJs = `(function(){
            try {
                const raw = ${safeTokenStr};
                if (!raw || raw === "undefined") return;
                const q = JSON.stringify(raw);
                localStorage.setItem("token", q);
                localStorage.setItem("default_token", q);
                localStorage.removeItem("multiaccount_tokens");
                if ((window.location.pathname.includes("/login") || window.location.pathname === "/") && !window.__mi_auto_redirected) {
                    window.__mi_auto_redirected = true;
                    window.location.href = "https://discord.com/channels/@me";
                }
            } catch(e) {}
        })();`;
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
            if (url.includes("/handoff")) {
                e.preventDefault();
                return;
            }
            if (!/^https:\/\/(ptb\.|canary\.)?discord\.com/.test(url)) e.preventDefault();
        });

        wc.setWindowOpenHandler(({ url }) => {
            if (url.includes("/handoff")) return { action: "deny" };
            if (url.startsWith("http")) require("electron").shell.openExternal(url);
            return { action: "deny" };
        });

        const validDomains = ["discord.com", "ptb.discord.com", "canary.discord.com"];
        const targetDomain = validDomains.includes(domain) ? domain : "discord.com";
        await win.loadURL(`https://${targetDomain}/channels/@me`);
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
    username = "",
    domain = "discord.com",
    blockExternalTokenAccess = false,
    performanceMode = false
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
        const savedPartition = `persist:guncord-mi-${userId}`;
        if (blockExternalTokenAccess) {
            try {
                const savedSes = session.fromPartition(savedPartition, { cache: true });
                await savedSes.clearStorageData();
                await savedSes.clearCache();
            } catch {}
        }

        const partition = blockExternalTokenAccess
            ? `guncord-mi-${userId}-${Date.now()}`
            : savedPartition;
        const ses = session.fromPartition(partition, { cache: !blockExternalTokenAccess });

        ses.webRequest.onBeforeRequest({ urls: ["*://*.discord.com/handoff*", "*://discord.com/handoff*"] }, (details, callback) => {
            callback({ cancel: true });
        });

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
                backgroundThrottling: performanceMode,
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
        // Redirects badge/notification IPCs to THIS window (not the main window)
        const cleanupNotifIpc = registerNotificationIpc(win);

        win.once("closed", () => {
            cleanupIpc();
            cleanupNotifIpc();
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

        const cleanTok = String(token || "").trim().replace(/^"+|"+$/g, "");
        const safeTokenStr = JSON.stringify(cleanTok);
        const injectJs = `(function(){
            try {
                const raw = ${safeTokenStr};
                if (!raw || raw === "undefined") return;
                const q = JSON.stringify(raw);
                localStorage.setItem("token", q);
                localStorage.setItem("default_token", q);
                localStorage.removeItem("multiaccount_tokens");
                if ((window.location.pathname.includes("/login") || window.location.pathname === "/") && !window.__mi_auto_redirected) {
                    window.__mi_auto_redirected = true;
                    window.location.href = "https://discord.com/channels/@me";
                }
            } catch(e) {}
        })();`;
        wc.on("dom-ready", () => wc.executeJavaScript(injectJs).catch(() => {}));
        wc.on("did-finish-load", () => wc.executeJavaScript(injectJs).catch(() => {}));
        wc.on("did-navigate", () => wc.executeJavaScript(injectJs).catch(() => {}));

        wc.on("page-title-updated", (e, title) => {
            const cleanTitle = title.replace(/^\(\d+\)\s*/, "").replace(/\s*\[.*\]$/, "");
            win.setTitle(`${cleanTitle} [${username || userId}]`);
            e.preventDefault();
        });

        wc.on("will-navigate", (e, url) => {
            if (url.includes("/handoff")) {
                e.preventDefault();
                return;
            }
            if (!/^https:\/\/(ptb\.|canary\.)?discord\.com/.test(url)) e.preventDefault();
        });

        wc.setWindowOpenHandler(({ url }) => {
            if (url.includes("/handoff")) return { action: "deny" };
            if (url.startsWith("http")) require("electron").shell.openExternal(url);
            return { action: "deny" };
        });

        const validDomains = ["discord.com", "ptb.discord.com", "canary.discord.com"];
        const targetDomain = validDomains.includes(domain) ? domain : "discord.com";
        await win.loadURL(`https://${targetDomain}/channels/@me`);
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
    return [...openWindows.entries(), ...openGroupedWindows.entries()]
        .filter(([, w]) => !w.isDestroyed())
        .map(([id]) => id);
}

export async function closeInstance(_: any, userId: string): Promise<void> {
    const win = openWindows.get(userId) || openGroupedWindows.get(userId);
    if (win && !win.isDestroyed()) {
        (win as any)._userRequestedClose = true;
        win.close();
    }
}
