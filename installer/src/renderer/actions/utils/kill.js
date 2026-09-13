const path = require("path");
const fs   = require("fs");
const {execSync, exec} = require("child_process");

function getProcName(resPath) {
    if (resPath.includes("DiscordPTB"))          return "DiscordPTB";
    if (resPath.includes("DiscordCanary"))        return "DiscordCanary";
    if (resPath.includes("DiscordDevelopment"))   return "DiscordDevelopment";
    return "Discord";
}

function killByName(name) {
    try { execSync(`taskkill /IM "${name}" /F /T`, { stdio: "ignore" }); } catch (_) {}
}

function isRunning(exeName) {
    try {
        const out = execSync(`tasklist /FI "IMAGENAME eq ${exeName}" /NH`, { encoding: "utf8" });
        return out.toLowerCase().includes(exeName.toLowerCase());
    } catch (_) { return false; }
}

async function waitForExit(exeName, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (!isRunning(exeName)) return true;
        await new Promise(r => setTimeout(r, 150));
    }
    return !isRunning(exeName);
}

export async function killDiscord(resPath, log) {
    const procName = getProcName(resPath);
    const exeName  = procName + ".exe";

    if (log) log(`Closing ${procName}...`);

    // ── Step 1: Graceful shutdown via Squirrel (Update.exe --processStop) ─────
    // Gives Discord time to flush its session data (localStorage,
    // cookies, Preferences) before we touch the resources/.
    // Without this, taskkill /F kills the process without flushing → token lost → logout.
    try {
        const appVersionDir = path.join(resPath, "..");
        const channelDir    = path.join(appVersionDir, "..");
        const updateExe     = path.join(channelDir, "Update.exe");
        if (fs.existsSync(updateExe)) {
            if (log) log(`Discretionary stay via Update.exe --processStop ${exeName}...`);
            exec(`"${updateExe}" --processStop ${exeName}`);
            // Wait up to 4 seconds for Discord to close cleanly
            const exitedGracefully = await waitForExit(exeName, 4000);
            if (exitedGracefully) {
                // Wait an additional 600ms to ensure the flush
                // of the Electron session (LevelDB / Preferences) is complete
                await new Promise(r => setTimeout(r, 600));
                if (log) log(`${procName} cleanly closed.`);
                return;
            }
            if (log) log(`Graceful closure expired, brute force kill...`);
        }
    } catch (_) {}

    // ── Stage 2 : Force kill (only if graceful shutdown failed) ───────
    killByName(exeName);

    const helperVariants = [
        `${procName} Helper.exe`,
        `${procName} Helper (GPU).exe`,
        `${procName} Helper (Plugin).exe`,
        `${procName} Helper (Renderer).exe`,
    ];
    for (const h of helperVariants) killByName(h);

    try {
        const appVersionDir = path.join(resPath, "..");
        const channelDir    = path.join(appVersionDir, "..");
        const updateExe     = path.join(channelDir, "Update.exe");
        if (fs.existsSync(updateExe)) {
            killByName("Update.exe");
        }
    } catch (_) {}

    // Wait for the process to disappear (max 4s) + 800ms post-kill flush.
    await waitForExit(exeName, 4000);
    await new Promise(r => setTimeout(r, 800));

    if (log) log(`${procName} closed.`);
}

export function startDiscord(resPath) {
    const procName = getProcName(resPath);
    const exeName  = procName + ".exe";
    const updateExe = path.join(resPath, "..", "..", "Update.exe");
    if (fs.existsSync(updateExe)) {
        try {
            exec(`"${updateExe}" --processStart ${exeName}`);
        } catch (_) {}
    }
}