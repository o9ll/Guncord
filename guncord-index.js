// Guncord entry point
"use strict";
const path = require("path");
const Module = require("module");
const fs = require("fs");
const { app } = require("electron");

// ── CRITICAL: userData = Guncord folder for settings/plugins
const guncordData = path.join(app.getPath("appData"), "Guncord");
app.setPath("userData", guncordData);

// Unique AppUserModelId — Windows recognizes Guncord as a separate app from Discord
app.setAppUserModelId("com.squirrel.Discord.Discord");

// Useful Chromium flags only (removing flags that harm startup:
// process-per-site, renderer-process-limit, enable-low-end-device-mode forced
// sub-processes and disabled GPU acceleration → freeze on splash screen)
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("disk-cache-size", "104857600");

app.once("ready", () => {
    try {
        // List of native modules that cause unnecessary 403 errors
        // NB: discord_overlay is intentionally ABSENT from this list —
        //     it must be able to initialize locally for in-game overlay to work.
        //     Only modules truly useless for Guncord are blocked.
        const BLOCKED_MODULES = new Set([
            // "discord_overlay",  // REMOVED — needed for in-game overlay
            "discord_rpc",
            "discord_dispatch",
            "discord_erinn",
        ]);

        const { session, shell } = require("electron");
        const { webContents: webContentsModule } = require("electron");

        // Legitimate Discord URLs not to block in will-navigate
        function isDiscordUrl(url) {
            return url.startsWith("https://discord.com") ||
                url.startsWith("https://canary.discord.com") ||
                url.startsWith("https://ptb.discord.com") ||
                url.startsWith("file://") ||
                url.startsWith("devtools://") ||
                url.startsWith("about:");
        }

        function patchWebContents(wc) {
            // Avoid patching the same webContents twice
            if (wc._guncordPatched) return;
            wc._guncordPatched = true;

            // Intercept window.open():
            // - about:blank is allowed (Discord needs it for legitimate popups)
            //   BUT we listen to did-create-window to immediately patch the child window
            // - devtools:// is allowed
            // - everything else → external browser
            wc.setWindowOpenHandler(({ url }) => {
                if (!url || url === "about:blank" || url.startsWith("devtools://")) {
                    return { action: "allow" };
                }
                shell.openExternal(url).catch(() => {});
                console.log("[Guncord][LINK] External open:", url);
                return { action: "deny" };
            });

            // KEY FIX: when about:blank creates a child window,
            // Discord then navigates to an external URL (TikTok, GitHub, etc.)
            // in that child window. We patch it immediately on creation
            // to block this navigation and open it in the browser.
            wc.on("did-create-window", (childWin, details) => {
                const childWc = childWin.webContents;
                if (childWc._guncordPatched) return;
                childWc._guncordPatched = true;

                // The child window starts on about:blank but will navigate to an external URL
                // Block any non-Discord navigation as soon as it happens
                const openUrl = details && details.url;
                if (openUrl && openUrl !== "about:blank" && !openUrl.startsWith("devtools://") && !isDiscordUrl(openUrl)) {
                    shell.openExternal(openUrl).catch(() => {});
                    console.log("[Guncord][NEW-WIN-DETAIL] Redirection externe:", openUrl);
                    try { childWin.destroy(); } catch (_) {}
                    return;
                }

                // La fenêtre enfant démarre sur about:blank mais va naviguer vers une URL externe
                // On bloque toute navigation non-Discord dès qu'elle se produit
                childWc.on("will-navigate", (event, url) => {
                    if (!isDiscordUrl(url)) {
                        event.preventDefault();
                        shell.openExternal(url).catch(() => {});
                        console.log("[Guncord][CHILD-NAV] External redirect:", url);
                        // Close the empty child window after redirect
                        try { childWin.close(); } catch (_) {}
                    }
                });

                // did-navigate covers cases where navigation already happened (OAuth, TikTok) before will-navigate
                childWc.on('did-navigate', function(_event, url) {
                    if (!isDiscordUrl(url)) {
                        shell.openExternal(url).catch(function() {});
                        console.log('[Guncord][CHILD-DID-NAV] External redirect after navigation:', url);
                        try { childWin.close(); } catch (_) {}
                    }
                });

                // Also block new navigations via setWindowOpenHandler in the child
                childWc.setWindowOpenHandler(({ url }) => {
                    if (!url || url === "about:blank" || url.startsWith("devtools://")) return { action: "allow" };
                    shell.openExternal(url).catch(() => {});
                    console.log("[Guncord][CHILD-LINK] External open:", url);
                    return { action: "deny" };
                });

                // Also block did-finish-load if the window loaded an external URL
                childWc.on("did-finish-load", () => {
                    const url = childWc.getURL();
                    if (url && url !== "about:blank" && !isDiscordUrl(url)) {
                        shell.openExternal(url).catch(() => {});
                        console.log("[Guncord][CHILD-LOAD] Closing and redirecting:", url);
                        try { childWin.close(); } catch (_) {}
                    }
                });

                // ── FIX "Discord Popup" (fenêtre blanche) ──────────────────────────
                // Discord crée parfois des BrowserWindow avec about:blank dont le titre
                // devient "Discord Popup". Ces fenêtres sont des popups OAuth/Nitro/overlay
                // qui chargent leur contenu via loadURL() côté main process (invisible pour
                // will-navigate). On les détecte par leur titre et on intercepte loadURL.
                function handleDiscordPopup() {
                    const url = childWc.getURL();
                    if (url && url !== "about:blank" && !url.startsWith("devtools://") && !isDiscordUrl(url)) {
                        shell.openExternal(url).catch(() => {});
                        console.log("[Guncord][POPUP] Redirection popup externe:", url);
                        try { childWin.destroy(); } catch (_) {}
                    }
                }

                childWin.on("page-title-updated", (_event, _title) => {
                    // Vérifier l'URL à chaque changement de titre — handleDiscordPopup
                    // ne fait rien si l'URL est Discord ou about:blank
                    handleDiscordPopup();
                });

                // Vérifier après un court délai si la fenêtre a chargé une URL externe
                // (cas où loadURL() est appelé côté main process avant nos handlers)
                setTimeout(() => {
                    try {
                        if (childWin.isDestroyed()) return;
                        handleDiscordPopup();
                    } catch (_) {}
                }, 300);

                setTimeout(() => {
                    try {
                        if (childWin.isDestroyed()) return;
                        handleDiscordPopup();
                    } catch (_) {}
                }, 1500);
            });

            // Block parent window navigations to external URLs
            wc.on("will-navigate", (event, url) => {
                const currentUrl = wc.getURL();
                if (url !== currentUrl && !isDiscordUrl(url)) {
                    event.preventDefault();
                    shell.openExternal(url).catch(() => {});
                    console.log("[Guncord][NAV] External redirect:", url);
                }
            });
        }

        // Patch all created webContents (windows AND popups)
        app.on("browser-window-created", (_, win) => {
            patchWebContents(win.webContents);
        });

        // Also patch webContents created without BrowserWindow (detached popups, etc.)
        app.on("web-contents-created", (_, wc) => {
            patchWebContents(wc);
        });

        // Patch already existing webContents at ready time
        for (const wc of webContentsModule.getAllWebContents()) {
            patchWebContents(wc);
        }

        console.log("[Guncord] External link patch active on ALL webContents (with did-create-window) ✓");

        app.once("browser-window-created", (_, win) => {

            try {
                const ses = session.defaultSession;
                ses.webRequest.onBeforeRequest(
                    { urls: ["https://discord.com/api/modules/*"] },
                    (details, callback) => {
                        const url = details.url;
                        let isBlocked = false;
                        for (const m of BLOCKED_MODULES) { if (url.includes(m)) { isBlocked = true; break; } }
                        if (isBlocked) {
                            // Block silently — avoids 403 + error logs
                            console.log("[Guncord] Blocked module (unused by Guncord):", url.split("/").slice(-2).join("/"));
                            callback({ cancel: true });
                        } else {
                            callback({});
                        }
                    }
                );
                console.log("[Guncord] 403 module filter activated ✓");
            } catch (e) {
                console.warn("[Guncord] Could not activate module filter:", e.message);
            }
        });
    } catch (e) {
        console.warn("[Guncord] 403 modules fix failed:", e.message);
    }
});

// Protection against freeze after crash — check and repair LevelDB localStorage
// When Discord crashes during a localStorage write, the LevelDB file can
// become corrupted and freeze the renderer on next startup.
try {
    const lsPath = path.join(guncordData, "Local Storage", "leveldb");
    if (fs.existsSync(lsPath)) {
        // Detect corruption: locked LOCK file or missing LOG file
        const lockFile = path.join(lsPath, "LOCK");
        const logFile = path.join(lsPath, "LOG");
        let corrupted = false;
        if (fs.existsSync(lockFile)) {
            try {
                // Try opening LOCK for writing — if it fails, a zombie process holds it
                const fd = fs.openSync(lockFile, "r+");
                fs.closeSync(fd);
            } catch (e) {
                // LOCK locked by a zombie — delete to unlock
                try { fs.unlinkSync(lockFile); } catch { }
                corrupted = true;
            }
        }
        // Also check corrupted .ldb files (size 0)
        if (!corrupted) {
            const files = fs.readdirSync(lsPath).filter(f => f.endsWith(".ldb"));
            for (const f of files) {
                const size = fs.statSync(path.join(lsPath, f)).size;
                if (size === 0) { corrupted = true; break; }
            }
        }
        if (corrupted) {
            console.warn("[Guncord] Corrupted LevelDB localStorage detected — repairing...");
            try { fs.rmSync(lsPath, { recursive: true, force: true }); } catch { }
            console.warn("[Guncord] LevelDB deleted — localStorage data will be recreated");
        }
    }
} catch (e) { console.warn("[Guncord] LevelDB check failed:", e.message); }

// Bundled modules in guncord-dist/modules/
const bundledModulesPath = path.join(path.dirname(process.execPath), "modules");
const moduleDataPath = path.join(app.getPath("appData"), "discord", "module_data");

// ── AUTO-DETECT Discord stable modules folder ──────────────────────────────
// Native modules (discord_voice, discord_krisp...) are in AppData\Local\Discord\app-X.X.XXXX\modules\
// NOT in AppData\Roaming\discord\module_data\ (which is often empty).
// We auto-detect the installed version to get the correct path.
const discordLocalBase = path.join(app.getPath("appData"), "..", "Local", "Discord");
let discordNativeModulesPath = null;
try {
    const entries = fs.readdirSync(discordLocalBase)
        .filter(e => e.startsWith("app-"))
        .map(e => ({ name: e, full: path.join(discordLocalBase, e, "modules") }))
        .filter(e => fs.existsSync(e.full))
        .sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
    if (entries.length > 0) {
        discordNativeModulesPath = entries[0].full;
        console.log("[Guncord] Discord native modules detected:", discordNativeModulesPath);
    }
} catch (e) {
    console.warn("[Guncord] Could not detect Discord native modules:", e.message);
}

// Use a Set for O(1) additions (instead of O(n) .includes() in loops)
const _globalPathsSet = new Set(Module.globalPaths);

function addGlobalPath(p) {
    try {
        if (!_globalPathsSet.has(p) && fs.existsSync(p)) {
            _globalPathsSet.add(p);
            Module.globalPaths.push(p);
        }
    } catch (_) { }
}

// Priority to bundled modules (portable, in guncord-dist/modules/)
addGlobalPath(bundledModulesPath);

// Add Discord native modules (discord_voice, discord_krisp, etc.)
if (discordNativeModulesPath) {
    addGlobalPath(discordNativeModulesPath);
    try {
        for (const mod of fs.readdirSync(discordNativeModulesPath)) {
            const modDir = path.join(discordNativeModulesPath, mod);
            try { if (!fs.statSync(modDir).isDirectory()) continue; } catch { continue; }
            addGlobalPath(modDir);
            // Enter the module subfolder (e.g. discord_voice-1/discord_voice/)
            try {
                for (const sub of fs.readdirSync(modDir)) {
                    const subDir = path.join(modDir, sub);
                    try { if (fs.statSync(subDir).isDirectory()) addGlobalPath(subDir); } catch { }
                }
            } catch { }
        }
    } catch (e) { console.warn("[Guncord] Error scanning native modules:", e.message); }
}
try {
    for (const mod of fs.readdirSync(bundledModulesPath)) {
        const modDir = path.join(bundledModulesPath, mod);
        try { if (!fs.statSync(modDir).isDirectory()) continue; } catch { continue; }
        addGlobalPath(modDir);
        try {
            for (const ver of fs.readdirSync(modDir)) {
                const verDir = path.join(modDir, ver);
                try { if (fs.statSync(verDir).isDirectory()) addGlobalPath(verDir); } catch { }
            }
        } catch { }
    }
} catch (e) { }

// Fallback: user module_data
addGlobalPath(moduleDataPath);
try {
    for (const mod of fs.readdirSync(moduleDataPath)) {
        const modDir = path.join(moduleDataPath, mod);
        try { if (!fs.statSync(modDir).isDirectory()) continue; } catch { continue; }
        addGlobalPath(modDir);
        try {
            for (const ver of fs.readdirSync(modDir)) {
                const verDir = path.join(modDir, ver);
                try { if (fs.statSync(verDir).isDirectory()) addGlobalPath(verDir); } catch { }
            }
        } catch { }
    }
} catch (e) { }

// This patch ensures modules loaded from Discord's asar (which have
// parent.paths = []) still find Guncord's native modules.
// Node.js already injects Module.globalPaths natively in all other cases.
const _globalPathsArr = Module.globalPaths.slice();
const _origResolve = Module._resolveLookupPaths;
Module._resolveLookupPaths = function (request, parent) {
    // Only for isolated asar contexts (empty paths) —
    // in all other cases, Node handles globalPaths itself, we don't touch anything.
    if (parent && (!parent.paths || parent.paths.length === 0)) {
        parent.paths = _globalPathsArr.slice();
    }
    return _origResolve.call(this, request, parent);
};

// Look up discord_desktop_core in this order:
// 1. bundled modules (portable)
// 2. local Discord native modules (AppData\Local\Discord\app-X\modules\)
// 3. Roaming module_data (fallback)
const coreModuleDir = path.join(bundledModulesPath, "discord_desktop_core-1", "discord_desktop_core");
const coreModuleDirNative = discordNativeModulesPath
    ? path.join(discordNativeModulesPath, "discord_desktop_core-1", "discord_desktop_core")
    : null;
global.mainAppDirname = fs.existsSync(coreModuleDir)
    ? coreModuleDir
    : (coreModuleDirNative && fs.existsSync(coreModuleDirNative))
        ? coreModuleDirNative
        : path.join(moduleDataPath, "discord_desktop_core");
console.log("[Guncord] mainAppDirname:", global.mainAppDirname);

// ── NATIVE AUDIO FIX: patch build_info.json so Discord finds modules ──
// Only patch once (quick check before any disk reads)
try {
    const buildInfoPath = path.join(
        path.dirname(process.execPath), "resources", "build_info.json"
    );
    const nativeModulesDir = path.join(path.dirname(process.execPath), "modules");
    // Only read the file if the modules folder exists
    if (fs.existsSync(nativeModulesDir)) {
        const buildInfoRaw = fs.readFileSync(buildInfoPath, "utf-8");
        const buildInfo = JSON.parse(buildInfoRaw);
        if (!buildInfo.localModulesRoot) {
            buildInfo.localModulesRoot = nativeModulesDir;
            fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
            console.log("[Guncord] build_info.json patched → localModulesRoot:", nativeModulesDir);
        }
    }
} catch (e) {
    console.warn("[Guncord] Could not patch build_info.json:", e.message);
}

require(path.join(__dirname, "dist", "desktop", "patcher.js"));

