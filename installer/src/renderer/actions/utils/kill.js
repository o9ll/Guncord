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

    await waitForExit(exeName, 3000);
    await new Promise(r => setTimeout(r, 400));

    if (log) log(`✅ ${procName} closed.`);
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