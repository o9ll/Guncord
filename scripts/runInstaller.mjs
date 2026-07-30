/*
 * Guncord — Installer via EquilotlCli
 * Downloads EquilotlCli.exe from Equicord releases and runs it
 * with env vars pointing to Guncord files.
 *
 * The exe shows a GUI to pick the target Discord.
 *
 * Usage:
 *   pnpm inject    → installs Guncord into the chosen Discord
 *   pnpm uninject  → uninstalls Guncord from the chosen Discord
 *   pnpm repair    → repairs the installation
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./checkNodeVersion.js";

import { execFileSync, execSync, exec } from "child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, renameSync, rmSync, statSync } from "fs";
import { chmodSync } from "fs";
import { dirname, join } from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";
import { fileURLToPath } from "url";

const BASE_URL = "https://github.com/Equicord/Equilotl/releases/latest/download/";
const INSTALLER_PATH_DARWIN = "Equilotl.app/Contents/MacOS/Equilotl";
const INSTALLER_APP_DARWIN = "Equilotl.app";

const BASE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const FILE_DIR = join(BASE_DIR, "dist", "Installer");
const ETAG_FILE = join(FILE_DIR, "etag.txt");

function getFilename() {
    switch (process.platform) {
        case "win32":  return "EquilotlCli.exe";
        case "darwin": return "Equilotl.MacOS.zip";
        case "linux":  return "EquilotlCli-linux";
        default: throw new Error("Unsupported platform: " + process.platform);
    }
}

async function ensureBinary() {
    const filename = getFilename();
    mkdirSync(FILE_DIR, { recursive: true });

    const downloadName = join(FILE_DIR, filename);
    const outputFile = process.platform === "darwin"
        ? join(FILE_DIR, INSTALLER_PATH_DARWIN)
        : downloadName;
    const outputApp = process.platform === "darwin"
        ? join(FILE_DIR, INSTALLER_APP_DARWIN)
        : null;

    if (existsSync(outputFile)) {
        console.log("[Guncord] Installer already present, using local copy.");
        return outputFile;
    }

    console.log("[Guncord] Downloading installer (" + filename + ")...");

    const res = await fetch(BASE_URL + filename, {
        headers: { "User-Agent": "Guncord (https://github.com/o9ll/Guncord)" }
    });

    if (!res.ok)
        throw new Error(`Failed to download installer: ${res.status} ${res.statusText}`);

    writeFileSync(ETAG_FILE, res.headers.get("etag") ?? "");

    if (process.platform === "darwin") {
        const zip = new Uint8Array(await res.arrayBuffer());
        writeFileSync(downloadName, zip);
        execSync(`ditto -x -k '${downloadName}' '${FILE_DIR}'`);
        try { execSync(`sudo xattr -dr com.apple.quarantine '${outputApp}'`); } catch { }
    } else {
        const body = Readable.fromWeb(res.body);
        await finished(body.pipe(createWriteStream(outputFile, { mode: 0o755, autoClose: true })));
    }

    if (process.platform !== "win32") {
        try { chmodSync(outputFile, 0o755); } catch { }
    }

    console.log("[Guncord] Installer downloaded successfully!");
    return outputFile;
}

// ── Check that build exists ───────────────────────────────────────────────────
function checkBuild() {
    const patcherPath = join(BASE_DIR, "dist", "desktop", "patcher.js");
    if (!existsSync(patcherPath)) {
        console.error("\x1b[31m[Guncord] dist/desktop/patcher.js not found!\x1b[0m");
        console.error("\x1b[33m           Run 'pnpm build' first, then try again.\x1b[0m");
        process.exit(1);
    }
}

// ── Remove incomplete Discord updates ──────────────────────────────────────────
// When Discord downloads an update but it's incomplete (no app.asar),
// the installer tries to inject and fails. We remove these broken folders.
function cleanIncompleteDiscordUpdates() {
    if (process.platform !== "win32") return;
    const localAppData = process.env.LOCALAPPDATA || "";
    for (const channel of ["Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment"]) {
        const base = join(localAppData, channel);
        if (!existsSync(base)) continue;
        let versions;
        try { versions = readdirSync(base).filter(d => /^app-\d+\.\d+\.\d+$/.test(d)); }
        catch { continue; }
        for (const ver of versions) {
            const resourcesDir = join(base, ver, "resources");
            const appAsarPath  = join(resourcesDir, "app.asar");
            const backupPath   = join(resourcesDir, "_app.asar");
            // Incomplete folder: resources exists but neither app.asar nor _app.asar
            if (existsSync(join(base, ver)) && !existsSync(appAsarPath) && !existsSync(backupPath)) {
                try {
                    rmSync(join(base, ver), { recursive: true, force: true });
                    console.log(`[Guncord] Removed incomplete Discord update folder: ${join(base, ver)}`);
                } catch (e) {
                    console.warn(`[Guncord] Could not remove ${join(base, ver)}: ${e.message}`);
                }
            }
        }
    }
}

// ── Clean previous injections ──────────────────────────────────────────────────
function cleanOldGuncord(isUninstall) {
    console.log("[Guncord] Cleaning previous installations...");
    const platform = process.platform;
    const candidates = [];

    if (platform === "win32") {
        const localAppData = process.env.LOCALAPPDATA || "";
        for (const channel of ["Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment"]) {
            const base = join(localAppData, channel);
            if (!existsSync(base)) continue;
            try {
                const versions = readdirSync(base).filter(d => /^app-\d+\.\d+\.\d+$/.test(d));
                for (const ver of versions) candidates.push(join(base, ver, "resources"));
            } catch { }
        }
    } else if (platform === "darwin") {
        candidates.push(
            "/Applications/Discord.app/Contents/Resources",
            "/Applications/Discord PTB.app/Contents/Resources",
            "/Applications/Discord Canary.app/Contents/Resources"
        );
    } else if (platform === "linux") {
        candidates.push(
            "/usr/share/discord/resources",
            "/usr/lib/discord/resources",
            "/opt/discord/resources",
            "/opt/Discord/resources",
            join(process.env.HOME || "", ".local/share/flatpak/app/com.discordapp.Discord/current/active/files/discord/resources"),
            "/snap/discord/current/usr/share/discord/resources"
        );
    }

    let cleanedAny = false;

    for (const resourcesDir of candidates) {
        if (!existsSync(resourcesDir)) continue;

        const appDirPath  = join(resourcesDir, "app");
        const backupPath  = join(resourcesDir, "_app.asar");
        const appAsarPath = join(resourcesDir, "app.asar");

        try {
            if (existsSync(appDirPath)) {
                let shouldDelete = false;
                try {
                    const pkgFile = join(appDirPath, "package.json");
                    if (existsSync(pkgFile)) {
                        const pkg = JSON.parse(readFileSync(pkgFile, "utf-8"));
                        if (pkg.name === "guncord") shouldDelete = true;
                    } else if (existsSync(backupPath)) {
                        shouldDelete = true;
                    }
                } catch { shouldDelete = true; }

                if (shouldDelete) {
                    rmSync(appDirPath, { recursive: true, force: true });
                    console.log(`[Guncord] Removed legacy app/ folder in ${resourcesDir}`);
                    cleanedAny = true;
                }
            }

            if (!isUninstall && existsSync(backupPath)) {
                if (existsSync(appAsarPath)) {
                    rmSync(appAsarPath, { recursive: true, force: true });
                }
                renameSync(backupPath, appAsarPath);
                console.log(`[Guncord] Restored _app.asar → app.asar in ${resourcesDir}`);
                cleanedAny = true;
            }

        } catch (e) {
            console.error(`[Guncord] Error cleaning ${resourcesDir}:`, e.message);
        }
    }

    if (cleanedAny) {
        console.log("[Guncord] Cleanup done.");
    } else {
        console.log("[Guncord] Nothing to clean.");
    }
}

// ── Launch Discord after injection ─────────────────────────────────────────────
// Finds which Discord was just injected (_app.asar present = injected)
// and launches it via Update.exe --processStart Discord.exe
function launchInjectedDiscord() {
    if (process.platform !== "win32") return;

    const localAppData = process.env.LOCALAPPDATA || "";
    const channels = ["Discord", "DiscordPTB", "DiscordCanary", "DiscordDevelopment"];

    for (const channel of channels) {
        const base = join(localAppData, channel);
        if (!existsSync(base)) continue;

        let versions;
        try { versions = readdirSync(base).filter(d => /^app-\d+\.\d+\.\d+$/.test(d)); }
        catch { continue; }

        for (const ver of versions) {
            const resourcesDir = join(base, ver, "resources");
            const backupPath   = join(resourcesDir, "_app.asar");

            // _app.asar present = EquilotlCli just injected here
            if (existsSync(backupPath)) {
                const exeName   = channel + ".exe";
                const updateExe = join(base, "Update.exe");

                if (existsSync(updateExe)) {
                    console.log(`[Guncord] Launching ${channel}...`);
                    exec(`"${updateExe}" --processStart ${exeName}`);
                } else {
                    // Fallback: launch the exe directly
                    const directExe = join(base, ver, channel + ".exe");
                    if (existsSync(directExe)) {
                        console.log(`[Guncord] Launching ${channel} (direct)...`);
                        exec(`"${directExe}"`);
                    }
                }
                return; // Launch the first injected Discord found
            }
        }
    }
}

// ── Main ──────────────────────────────────────────────────────────────────────
const argStart = process.argv.indexOf("--");
const args = argStart === -1 ? process.argv.slice(2) : process.argv.slice(argStart + 1);

const isUninstall = args.includes("--uninstall");
cleanIncompleteDiscordUpdates();
cleanOldGuncord(isUninstall);
if (!isUninstall) checkBuild();

const installerBin = await ensureBinary();

console.log("[Guncord] Injecting...");

const mappedArgs = args.map(a => {
    if (a === "--install") return "-install";
    if (a === "--uninstall") return "-uninstall";
    if (a === "--repair") return "-repair";
    return a;
});

if (!mappedArgs.includes("-branch") && !mappedArgs.includes("--branch")) {
    mappedArgs.push("-branch", "auto");
}

try {
    execFileSync(installerBin, mappedArgs, {
        stdio: "inherit",
        env: {
            ...process.env,
            EQUICORD_USER_DATA_DIR: BASE_DIR,
            EQUICORD_DIRECTORY: join(BASE_DIR, "dist", "desktop"),
            EQUICORD_DEV_INSTALL: "1",
            GUNCORD_DIRECTORY: join(BASE_DIR, "dist", "desktop")
        }
    });
} catch {
    console.error("[Guncord] Injection failed.");
    process.exit(1);
}

// Launch Discord only after a successful injection (not after uninstall)
if (!isUninstall) {
    launchInjectedDiscord();
}

