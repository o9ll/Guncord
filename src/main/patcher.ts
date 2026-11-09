/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { onceDefined } from "@shared/onceDefined";
import electron, { app, BrowserWindowConstructorOptions, Menu, session } from "electron";
import { appendFileSync, existsSync as fsExistsSync, readFileSync, statSync as fsStatSync, writeFileSync } from "original-fs";
import { dirname, join } from "path";

import { makeLinksOpenExternally } from "./utils/externalLinks";
import { RendererSettings } from "./settings";
import { patchTrayMenu } from "./trayMenu";
import { applyPendingUpdateOnStartup } from "./updater/pendingUpdate";
import { IS_VANILLA } from "./utils/constants";
import PluginNatives from "~pluginNatives";

const DEBUG_LOG_FILE = process.env.GUNCORD_LOG_FILE || (process.argv.includes("--guncord-debug-logs") ? join(process.env.TEMP || ".", "guncord-debug.log") : "");

function writeDebugLine(prefix: string, msg: string) {
    if (!DEBUG_LOG_FILE) return;
    const now = new Date();
    const ts = now.toTimeString().slice(0, 8) + "." + String(now.getMilliseconds()).padStart(3, "0");
    const line = `[${ts}] [${prefix}] ${msg}\n`;
    try {
        appendFileSync(DEBUG_LOG_FILE, line, "utf8");
    } catch { }
}

if (DEBUG_LOG_FILE) {
    try {
        writeFileSync(DEBUG_LOG_FILE, "", "utf8");
    } catch { }
    writeDebugLine("MAIN", "Guncord Debug Logger initialized (PID: " + process.pid + ")");

    for (const method of ["log", "info", "warn", "error"] as const) {
        const orig = console[method].bind(console);
        console[method] = (...args: any[]) => {
            orig(...args);
            try {
                const text = args.map(a => typeof a === "string" ? a : (a instanceof Error ? (a.stack || a.message) : JSON.stringify(a))).join(" ");
                writeDebugLine(`MAIN:${method.toUpperCase()}`, text);
            } catch { }
        };
    }

    let lastTick = Date.now();
    const freezeTimer = setInterval(() => {
        const now = Date.now();
        const drift = now - lastTick - 100;
        lastTick = now;
        if (drift > 150) {
            writeDebugLine("PERF-FREEZE", `MAIN PROCESS BLOCKED FOR ${drift}ms!`);
        }
    }, 100);
    freezeTimer.unref?.();
}

console.log("[Guncord] Starting up...");

// Our injector file inside app.asar / app/index.js
const injectorPath = require.main!.filename;

// The original app.asar (discord_app.asar is immune to Squirrel cleaner, _app.asar fallback)
const _primaryAsar = join(dirname(injectorPath), "..", "discord_app.asar");
const _secondaryAsar = join(dirname(injectorPath), "..", "_app.asar");
const _resourcesPrimary = join(process.resourcesPath, "discord_app.asar");
const _resourcesSecondary = join(process.resourcesPath, "_app.asar");

const asarPath = (fsExistsSync(_primaryAsar) && !fsStatSync(_primaryAsar).isDirectory())
    ? _primaryAsar
    : (fsExistsSync(_secondaryAsar) && !fsStatSync(_secondaryAsar).isDirectory())
        ? _secondaryAsar
        : (fsExistsSync(_resourcesPrimary) && !fsStatSync(_resourcesPrimary).isDirectory())
            ? _resourcesPrimary
            : _resourcesSecondary;

const discordPkg = require(join(asarPath, "package.json"));
require.main!.filename = join(asarPath, discordPkg.main);
if (IS_VESKTOP || IS_EQUIBOP) require.main!.filename = join(dirname(injectorPath), "..", "..", "package.json");

// @ts-expect-error Untyped method
app.setAppPath(asarPath);

// Apply any staged Guncord updates AFTER the asar path is resolved and set,
// so that copying new files cannot corrupt the currently-loading module chain.
applyPendingUpdateOnStartup();

if (!IS_VANILLA) {
    const settings = RendererSettings.store;

    patchTrayMenu();

    /*
     * re-apply the patch when discord ships a new host version. skipped
     * on vesktop and equibop because they manage their own updates.
     */
    if (!IS_VESKTOP && !IS_EQUIBOP) {
        try {
            require("./hostUpdateHook").installHostUpdateHook();
        } catch (err) {
            console.error("[Guncord] Failed to install host update hook", err);
        }
    }

    // Repatch after host updates on Windows and Linux
    if (process.platform === "win32" || process.platform === "linux") {
        require("./persistAfterDiscordUpdates");
    }

    if (process.platform === "win32" && settings.winCtrlQ) {
        const originalBuild = Menu.buildFromTemplate;
        Menu.buildFromTemplate = function (template) {
            if (template[0]?.label === "&File") {
                const { submenu } = template[0];
                if (Array.isArray(submenu)) {
                    submenu.push({
                        label: "Quit (Hidden)",
                        visible: false,
                        acceleratorWorksWhenHidden: true,
                        accelerator: "Control+Q",
                        click: () => {
                            try {
                                (PluginNatives as any)?.MultiInstance?.setExplicitAppQuit?.(true);
                            } catch {}
                            app.quit();
                        }
                    });
                }
            }
            return originalBuild.call(this, template);
        };
    }

    const instanceUserId = process.env.GUNCORD_INSTANCE_USER ||
        process.argv.find(a => a.startsWith("--guncord-instance-user="))?.split("=")[1];

    let instanceConfig: {
        userId?: string;
        username?: string;
        token?: string;
        domain?: string;
        uniqueAppId?: string;
        iconPath?: string;
    } | null = null;

    if (instanceUserId) {
        try {
            const instDir = process.env.GUNCORD_INSTANCE_DIR || join(app.getPath("appData"), `Guncord-Instance-${instanceUserId}`);
            const possiblePaths = [
                join(instDir, "guncord-instance.json"),
                join(instDir, "discord", "guncord-instance.json"),
                join(app.getPath("userData"), "guncord-instance.json")
            ];
            for (const p of possiblePaths) {
                if (fsExistsSync(p)) {
                    instanceConfig = JSON.parse(readFileSync(p, "utf-8"));
                    break;
                }
            }
        } catch (e) {
            console.warn("[Guncord] Failed to read instance config:", e);
        }
    }

    class BrowserWindow extends electron.BrowserWindow {
        constructor(options: BrowserWindowConstructorOptions) {
            if (!options?.webPreferences?.preload || !options.title) {
                super(options);
                return;
            }

            const original = options.webPreferences.preload;
            const isMainWindow = options.title === "Discord";

            if (!isMainWindow) {
                super(options);
                return;
            }

            if (instanceConfig) {
                options.title = `Guncord [${instanceConfig.username || instanceUserId}]`;
                if (instanceConfig.iconPath && fsExistsSync(instanceConfig.iconPath)) {
                    options.icon = instanceConfig.iconPath;
                }
            }

            options.webPreferences.preload = join(__dirname, "preload.js");
            options.webPreferences.sandbox = false;
            options.webPreferences.backgroundThrottling = false;

            if (settings.mainWindowFrameless && isMainWindow) {
                options.frame = false;
            } else if (settings.frameless) {
                options.frame = false;
            } else if (process.platform === "win32" && settings.winNativeTitleBar) {
                delete options.frame;
            }

            if (settings.disableMinSize) {
                options.minWidth = 0;
                options.minHeight = 0;
            }

            if (settings.transparent) {
                options.transparent = true;
                options.backgroundColor = "#00000000";
            }
            if (process.platform === "darwin" && settings.macosVibrancyStyle) {
                options.vibrancy = settings.macosVibrancyStyle;
                options.backgroundColor = "#00000000";
            }
            if (process.platform === "win32" && settings.windowMaterial && settings.windowMaterial !== "none") {
                options.backgroundMaterial = settings.windowMaterial as any;
                options.backgroundColor = "#00000000";
            }

            if (!options.backgroundColor && !settings.transparent) {
                options.backgroundColor = "#313338";
            }

            process.env.DISCORD_PRELOAD = original;

            super(options);

            if (isMainWindow) {
                (this as any).__isMainWindow = true;
                makeLinksOpenExternally(this);

                if (instanceConfig) {
                    (this as any).__isMultiInstanceProcess = true;
                    if (process.platform === "win32") {
                        try {
                            this.setAppDetails({
                                appId: instanceConfig.uniqueAppId || `guncord.instance.${instanceUserId}`,
                                appIconPath: instanceConfig.iconPath || undefined,
                                relaunchDisplayName: `Guncord [${instanceConfig.username || instanceUserId}]`
                            });
                        } catch {}
                    }

                    this.webContents.on("page-title-updated", (e, title) => {
                        const cleanTitle = title.replace(/^\(\d+\)\s*/, "").replace(/\s*\[.*\]$/, "");
                        this.setTitle(`${cleanTitle} [${instanceConfig!.username || instanceUserId}]`);
                        e.preventDefault();
                    });

                    if (instanceConfig.token) {
                        const rawTok = instanceConfig.token;
                        const uId = instanceConfig.userId || instanceUserId;
                        const tokenInjectJs = `(function() {
                            try {
                                var t = ${JSON.stringify(rawTok)};
                                var qt = JSON.stringify(t);
                                localStorage.setItem("token", qt);
                                localStorage.setItem("default_token", qt);
                                localStorage.setItem("user_id_cache", JSON.stringify(${JSON.stringify(uId)}));
                                Object.defineProperty(window, "__guncord_token", { value: t, writable: false, configurable: true });
                                Object.defineProperty(window, "__guncord_user_id", { value: ${JSON.stringify(uId)}, writable: false, configurable: true });
                            } catch(e) {}
                        })();`;
                        this.webContents.on("dom-ready", () => {
                            this.webContents.executeJavaScript(tokenInjectJs).catch(() => {});
                        });
                    }
                }

                if (DEBUG_LOG_FILE) {
                    const levelNames = ["DEBUG", "INFO", "WARN", "ERROR"];
                    this.webContents.on("console-message", (_event, level, message, line, sourceId) => {
                        const lvl = levelNames[level] || "LOG";
                        const cleanMsg = String(message || "").replace(/%c/g, "").replace(/\b(?:color|background|font-weight|padding|border-radius)\s*:[^;\n]+;?/gi, "").trim();
                        const shortSrc = sourceId ? sourceId.split("/").pop() : "renderer";
                        writeDebugLine(`RENDERER:${lvl}`, `${cleanMsg} (${shortSrc}:${line})`);
                    });
                }

                this.on("show", () => {
                    (this as any).__hiddenDueToMultiInstance = false;
                });

                this.on("close", (event) => {
                    if ((this as any).__isMultiInstanceProcess) {
                        return;
                    }
                    try {
                        const multi = (PluginNatives as any)?.MultiInstance;
                        const isExplicitQuit = typeof multi?.getExplicitAppQuit === "function"
                            ? multi.getExplicitAppQuit()
                            : false;
                        const hasInstances = typeof multi?.hasActiveMultiInstances === "function"
                            ? multi.hasActiveMultiInstances()
                            : false;

                        if (isExplicitQuit) {
                            return;
                        }

                        if (hasInstances) {
                            event.preventDefault();
                            (this as any).__hiddenDueToMultiInstance = true;
                            this.hide();
                        }
                    } catch (err) {
                        console.error("[Guncord] Error in mainWindow close handler:", err);
                    }
                });
            }

            if (settings.streamProof) {
                try {
                    this.setContentProtection(true);
                } catch (e) {
                    console.error("Failed to set content protection on startup:", e);
                }
            }

            if (settings.disableMinSize) {
                this.setMinimumSize = (_width: number, _height: number) => { };
            }
        }
    }
    Object.assign(BrowserWindow, electron.BrowserWindow);
    Object.defineProperty(BrowserWindow, "name", { value: "BrowserWindow", configurable: true });

    const electronPath = require.resolve("electron");
    delete require.cache[electronPath]!.exports;
    require.cache[electronPath]!.exports = {
        ...electron,
        BrowserWindow
    };

    onceDefined(global, "appSettings", s => {
        s.set("DANGEROUS_ENABLE_DEVTOOLS_ONLY_ENABLE_IF_YOU_KNOW_WHAT_YOURE_DOING", true);
    });

    process.env.DATA_DIR = join(app.getPath("userData"), "..", "Guncord");

    // Auto-recover session data if it was accidentally redirected to app/Data
    try {
        const strayDataDir = join(process.resourcesPath, "..", "Data");
        const straySession = join(strayDataDir, "sessionData");
        const officialUserData = app.getPath("userData");
        if (fsExistsSync(straySession) && officialUserData) {
            const { cpSync, rmSync } = require("fs");
            for (const item of ["Local Storage", "IndexedDB", "Network", "Preferences"]) {
                const src = join(straySession, item);
                const dst = join(officialUserData, item);
                if (fsExistsSync(src)) {
                    try {
                        cpSync(src, dst, { recursive: true, force: true });
                    } catch { }
                }
            }
            try {
                rmSync(strayDataDir, { recursive: true, force: true });
            } catch { }
            console.log("[Guncord] Restored session data to official userData directory");
        }
    } catch (e) {
        console.error("[Guncord] Session migration failed:", e);
    }
} else {
    console.log("[Guncord] Running in vanilla mode. Not loading Guncord");
}

console.log("[Guncord] Loading original Discord app.asar");
require(require.main!.filename);
