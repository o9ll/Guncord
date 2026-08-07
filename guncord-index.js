// Guncord entry point
"use strict";
const path = require("path");
const Module = require("module");
const fs = require("fs");
const { app } = require("electron");

// ─────────────────────────────────────────────────────────────────────────────
// PENDING UPDATE CHECK — must run BEFORE any dist/ file is loaded (= locked).
// When the in-app updater stages an update it writes a marker file next to this
// script.  We apply it here (simple file copy) while nothing is locked yet,
// then delete the marker and continue the normal boot.
// This is what prevents the infinite-restart loop.
// ─────────────────────────────────────────────────────────────────────────────
(function applyPendingUpdate() {
    const markerPath = path.join(__dirname, "dist", "guncord", "guncord-pending-update.json");
    if (!fs.existsSync(markerPath)) return;

    let marker;
    try {
        marker = JSON.parse(fs.readFileSync(markerPath, "utf-8"));
    } catch {
        try { fs.unlinkSync(markerPath); } catch { }
        return;
    }

    const { stagingDir, destDir } = marker;
    if (!stagingDir || !destDir || !fs.existsSync(stagingDir)) {
        try { fs.unlinkSync(markerPath); } catch { }
        return;
    }

    console.log("[Guncord] Applying pending update from", stagingDir, "→", destDir);

    function copyDirSync(src, dest) {
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);
            if (entry.isDirectory()) {
                copyDirSync(srcPath, destPath);
            } else {
                try {
                    fs.copyFileSync(srcPath, destPath);
                } catch (e) {
                    console.warn("[Guncord] Could not copy", srcPath, ":", e.message);
                }
            }
        }
    }

    try {
        copyDirSync(stagingDir, destDir);
        console.log("[Guncord] Pending update applied successfully.");
    } catch (e) {
        console.error("[Guncord] Failed to apply pending update:", e.message);
    }

    // Always delete marker and staging dir so we don't loop
    try { fs.unlinkSync(markerPath); } catch { }
    try { fs.rmSync(stagingDir, { recursive: true, force: true }); } catch { }
})();
// ─────────────────────────────────────────────────────────────────────────────

// Guncord mod data directory is managed by DATA_DIR in constants.ts
const guncordData = path.join(app.getPath("appData"), "Guncord");

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
            if (wc._guncordPatched) return;
            wc._guncordPatched = true;

            wc.setWindowOpenHandler(({ url, frameName }) => {
                if (frameName && (frameName.includes("Overlay") || frameName.startsWith("DISCORD_"))) {
                    if (frameName.includes("Overlay")) return { action: "deny" };
                }
                if (!url || url === "about:blank" || url.startsWith("devtools://")) {
                    return { action: "allow" };
                }
                if (!isDiscordUrl(url)) {
                    shell.openExternal(url).catch(() => {});
                    console.log("[Guncord][LINK] External link opened:", url);
                    return { action: "deny" };
                }
                return { action: "allow" };
            });

            wc.on("did-create-window", (childWin, details) => {
                // Hide immediately to prevent white popup window from rendering on screen
                try { childWin.hide(); } catch {}

                const childWc = childWin.webContents;
                if (childWc._guncordPatched) return;
                childWc._guncordPatched = true;

                const openUrl = details && details.url;
                if (openUrl && openUrl !== "about:blank" && !openUrl.startsWith("devtools://") && !isDiscordUrl(openUrl)) {
                    shell.openExternal(openUrl).catch(() => {});
                    console.log("[Guncord][NEW-WIN-DETAIL] External redirect:", openUrl);
                    try { childWin.destroy(); } catch (_) {}
                    return;
                }

                childWc.on("will-navigate", (event, url) => {
                    if (!isDiscordUrl(url)) {
                        event.preventDefault();
                        shell.openExternal(url).catch(() => {});
                        console.log("[Guncord][CHILD-NAV] External redirect:", url);
                        try { childWin.destroy(); } catch (_) {}
                    }
                });

                childWc.on("did-navigate", (_event, url) => {
                    if (!isDiscordUrl(url)) {
                        shell.openExternal(url).catch(() => {});
                        console.log("[Guncord][CHILD-DID-NAV] External redirect:", url);
                        try { childWin.destroy(); } catch (_) {}
                    }
                });

                childWc.setWindowOpenHandler(({ url }) => {
                    if (!url || url === "about:blank" || url.startsWith("devtools://")) return { action: "allow" };
                    shell.openExternal(url).catch(() => {});
                    console.log("[Guncord][CHILD-LINK] External open:", url);
                    return { action: "deny" };
                });

                childWc.on("did-finish-load", () => {
                    const url = childWc.getURL();
                    if (url && url !== "about:blank" && !isDiscordUrl(url)) {
                        shell.openExternal(url).catch(() => {});
                        console.log("[Guncord][CHILD-LOAD] Closure and redirection:", url);
                        try { childWin.destroy(); } catch (_) {}
                    }
                });

                // Destroy any lingering blank popup after 100ms
                setTimeout(() => {
                    try {
                        if (!childWin.isDestroyed()) {
                            const u = childWc.getURL();
                            const title = childWin.getTitle();
                            if (!u || u === "about:blank" || u.includes("/popup") || title === "discord" || title === "Discord Popup") {
                                try { childWin.destroy(); } catch (_) {}
                            }
                        }
                    } catch (_) {}
                }, 100);
            });

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

// Cleanup legacy localModulesRoot in build_info.json so Discord uses its native voice modules and preserves audio settings
try {
    const buildInfoPath = path.join(path.dirname(process.execPath), "resources", "build_info.json");
    if (fs.existsSync(buildInfoPath)) {
        const buildInfoRaw = fs.readFileSync(buildInfoPath, "utf-8");
        if (buildInfoRaw.includes('"localModulesRoot"')) {
            const buildInfo = JSON.parse(buildInfoRaw);
            delete buildInfo.localModulesRoot;
            fs.writeFileSync(buildInfoPath, JSON.stringify(buildInfo, null, 2));
            console.log("[Guncord] Cleaned legacy localModulesRoot from build_info.json");
        }
    }
} catch { }

require(path.join(__dirname, "dist", "desktop", "patcher.js"));
