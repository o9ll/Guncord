/**
 * Exact port of C# KillDiscord() and StartDiscord() from Program.cs
 * — Improved: kills ALL Discord processes (helpers, renderers, Update.exe)
 *   to ensure that app.asar is released before renaming.
 */
const path = require("path");
const fs   = require("fs");
const {execSync, execFileSync, exec} = require("child_process");

/**
 * Determine the Discord process name from the resources path.
 * Mirrors: resPath.Contains("DiscordPTB") ? "DiscordPTB" : ...
 */
function getProcName(resPath) {
    if (resPath.includes("DiscordPTB"))          return "DiscordPTB";
    if (resPath.includes("DiscordCanary"))        return "DiscordCanary";
    if (resPath.includes("DiscordDevelopment"))   return "DiscordDevelopment";
    return "Discord";
}

/**
 * Kill a process by name (force + child process tree).
 */
function killByName(name) {
    try { execSync(`taskkill /IM "${name}" /F /T`, { stdio: "ignore" }); } catch (_) {}
}

/**
 * Check if a process is still running via tasklist.
 */
function isRunning(exeName) {
    try {
        const out = execSync(`tasklist /FI "IMAGENAME eq ${exeName}" /NH`, { encoding: "utf8" });
        return out.toLowerCase().includes(exeName.toLowerCase());
    } catch (_) { return false; }
}

/**
 * Wait (synchronously blocking) for the process to disappear,
 * or up to the timeout in ms.
 */
function waitForExit(exeName, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (!isRunning(exeName)) return true;
        const slice = Date.now() + 200;
        while (Date.now() < slice) {}
    }
    return !isRunning(exeName);
}

/**
 * Wait (synchronously) for a certain number of ms.
 */
function sleep(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) {}
}

/**
 * Improved KillDiscord:
 *  1. Kill the main process
 *  2. Kill Helper / Renderer processes (they keep app.asar open)
 *  3. Kill Update.exe if it exists in the parent folder
 *  4. Wait for all processes to exit (up to 8s)
 *  5. Wait another 1.5s for Windows to release file handles
 */
export function killDiscord(resPath, log) {
    const procName = getProcName(resPath);
    const exeName  = procName + ".exe";

    if (log) log(`Closing ${procName}...`);

    // ── Step 1: kill the main process and its variants ──
    killByName(exeName);

    // Discord creates child processes with names like:
    //   Discord Helper.exe, Discord Helper (GPU).exe, etc.
    // Kill them all.
    const helperVariants = [
        `${procName} Helper.exe`,
        `${procName} Helper (GPU).exe`,
        `${procName} Helper (Plugin).exe`,
        `${procName} Helper (Renderer).exe`,
    ];
    for (const h of helperVariants) killByName(h);

    // ── Step 2: kill Update.exe in the parent folder (it keeps app.asar open) ──
    // resPath = …\DiscordCanary\app-X.X.XXXX\resources
    //  → parent      = …\DiscordCanary\app-X.X.XXXX
    //  → grandparent = …\DiscordCanary
    try {
        const appVersionDir = path.join(resPath, "..");
        const channelDir    = path.join(appVersionDir, "..");
        const updateExe     = path.join(channelDir, "Update.exe");
        if (fs.existsSync(updateExe)) {
            // Kill by full path via wmic for accuracy
            try {
                execSync(
                    `wmic process where "ExecutablePath='${updateExe.replace(/\\/g, "\\\\")}'" delete`,
                    { stdio: "ignore" }
                );
            } catch (_) {}
            // Fallback: kill by process name
            killByName("Update.exe");
        }
    } catch (_) {}

    // ── Step 3: wait for the main process to exit (up to 8s) ──
    const exited = waitForExit(exeName, 8000);
    if (log && !exited) log(`⚠️ ${procName} is still running after 8s — continuing anyway...`);

    // ── Step 4: give Windows extra time to release file handles ──
    // Windows may keep file handles open for a few hundred
    // ms after the process exits — required to avoid EBUSY.
    sleep(1500);

    if (log) log(`✅ ${procName} closed.`);
}

/**
 * Port of C# StartDiscord(resPath):
 *   var exe = Path.Combine(Path.GetDirectoryName(resPath), "..", "Update.exe");
 *   if (File.Exists(exe)) Process.Start(exe, "--processStart Discord.exe");
 */
export function startDiscord(resPath) {
    const procName = getProcName(resPath);
    const exeName  = procName + ".exe";
    // resPath = app-X.X.XXXX\resources  →  go up 2 levels to get to the Discord channel dir
    const updateExe = path.join(resPath, "..", "..", "Update.exe");
    if (fs.existsSync(updateExe)) {
        try {
            exec(`"${updateExe}" --processStart ${exeName}`);
        } catch (_) {}
    }
}