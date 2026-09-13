/*!
 * Guncord, a modification for Discord's desktop app
 * Copyright (c) 2026 o9
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// DO NOT REMOVE UNLESS YOU WISH TO FACE THE WRATH OF THE CIRCULAR DEPENDENCY DEMON!!!!!!!
import "~plugins";
import "./fixWeirdAppRegionBug.css";

export * as Api from "./api";
export * as DataStore from "./api/DataStore";
export * as Plugins from "./api/PluginManager";
export * as Components from "./components";
export * as Util from "./utils";
export * as Updater from "./utils/updater";
export * as Webpack from "./webpack";
export * as WebpackPatcher from "./webpack/patchWebpack";
export { PlainSettings, Settings };

import { coreStyleRootNode, initStyles } from "@api/Styles";
import { openSettingsTabModal, UpdaterTab } from "@components/settings";
import { addHeaderBarButton, HeaderBarButton } from "@api/HeaderBar";
import { debounce } from "@shared/debounce";
import { IS_WINDOWS } from "@utils/constants";
import { createAndAppendStyle } from "@utils/css";
import { StartAt } from "@utils/types";
import { SettingsRouter } from "@webpack/common";

import { get as dsGet } from "./api/DataStore";
import { popNotice, showNotice } from "./api/Notices";
import { showNotification } from "./api/Notifications";
import { initPluginManager, PMLogger, startAllPlugins } from "./api/PluginManager";
import { initUserPluginsEngine } from "./api/UserPlugins";
import { PlainSettings, Settings, SettingsStore } from "./api/Settings";
import { getCloudSettings, putCloudSettings, shouldCloudSync } from "./api/SettingsSync/cloudSync";
import { localStorage } from "./utils/localStorage";
import { relaunch } from "./utils/native";
import { checkForUpdates, isOutdated as getIsOutdated, rebuild, update, UpdateLogger } from "./utils/updater";
import { onceReady } from "./webpack";
import { patches } from "./webpack/patchWebpack";

if (IS_REPORTER) {
    require("./debug/runReporter");
}

async function syncSettings() {
    // Check if cloud auth exists for current user before attempting sync
    if (localStorage.Vencord_cloudSyncDirection === undefined) {
        // by default, sync bi-directionally
        localStorage.Vencord_cloudSyncDirection = "both";
    }
    const hasCloudAuth = await dsGet("Vencord_cloudSecret");
    if (!hasCloudAuth) {
        if (Settings.cloud.authenticated) {
            // User switched to an account that isn't connected to cloud
            showNotification({
                title: "Cloud Settings",
                body: "Cloud sync was disabled because this account isn't connected to the cloud App. You can enable it again by connecting this account in Cloud Settings. (note: it will store your preferences separately)",
                color: "var(--yellow-360)",
                onClick: () => SettingsRouter.openUserSettings("equicord_cloud_panel")
            });
            // Disable cloud sync globally
            Settings.cloud.authenticated = false;
        }
        return;
    }

    // pre-check for local shared settings
    if (
        Settings.cloud.authenticated &&
        !hasCloudAuth // this has been enabled due to local settings share or some other bug
    ) {
        // show a notification letting them know and tell them how to fix it
        showNotification({
            title: "Cloud Integrations",
            body: "We've noticed you have cloud integrations enabled in another client! Due to limitations, you will " +
                "need to re-authenticate to continue using them. Click here to go to the settings page to do so!",
            color: "var(--yellow-360)",
            onClick: () => SettingsRouter.openUserSettings("equicord_cloud_panel")
        });
        return;
    }

    if (
        Settings.cloud.settingsSync && // if it's enabled
        Settings.cloud.authenticated && // if cloud integrations are enabled
        localStorage.Vencord_cloudSyncDirection !== "manual" // if we're not in manual mode
    ) {
        if (localStorage.Vencord_settingsDirty && shouldCloudSync("push")) {
            await putCloudSettings();
        } else if (shouldCloudSync("pull") && await getCloudSettings(false)) { // if we synchronized something (false means no sync)
            // we show a notification here instead of allowing getCloudSettings() to show one to declutter the amount of
            // potential notifications that might occur. getCloudSettings() will always send a notification regardless if
            // there was an error to notify the user, but besides that we only want to show one notification instead of all
            // of the possible ones it has (such as when your settings are newer).
            showNotification({
                title: "Cloud Settings",
                body: "Your settings have been updated! Click here to restart to fully apply changes!",
                color: "var(--green-360)",
                onClick: relaunch
            });
        }
    }

    const saveSettingsOnFrequentAction = debounce(async () => {
        if (Settings.cloud.settingsSync && Settings.cloud.authenticated && shouldCloudSync("push")) {
            await putCloudSettings();
        }
    }, 60_000);

    SettingsStore.addGlobalChangeListener(() => {
        localStorage.Vencord_settingsDirty = true;
        saveSettingsOnFrequentAction();
    });
}

const GUNCORD_LOGO_URI = "data:image/png;base64,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";

let stagedThisSession = false;

/**
 * Downloads and stages the update silently in the background.
 * No banner, no user interaction needed.
 * guncord-index.js will apply the staged files on the next restart.
 */
async function silentlyStageUpdate() {
    if (stagedThisSession) return;
    stagedThisSession = true;

    try {
        UpdateLogger.info("Silently staging update in background...");
        // checkForUpdates() already set pendingDownloadUrl via IpcEvents.GET_UPDATES → getUpdates() → fetchUpdates()
        // So we call rebuild() (= stageUpdate) directly — no redundant API call needed.
        await rebuild(); // downloads zip to %temp%, extracts to staging dir, writes marker — no locked files touched
        UpdateLogger.info("Update staged successfully. Will be applied on next Discord restart.");

        // Notify user in the top-right corner that the update is ready to be applied on restart
        showNotification({
            id: "guncord-update-downloaded",
            title: "Update Downloaded",
            body: "A new update has been downloaded. Restart your client to apply and discover what's new.",
            icon: "guncord",
            type: "info",
            duration: 9000,
            actions: [
                {
                    label: "Restart Now",
                    onClick: () => relaunch()
                }
            ]
        });
    } catch (e) {
        UpdateLogger.error("Silent update staging failed", e);
        stagedThisSession = false; // allow retry on next check interval
    }
}

async function runUpdateCheck() {
    if (IS_UPDATER_DISABLED || Settings.disableAutoUpdate) return;

    try {
        const isOutdated = await checkForUpdates();
        if (IS_DISCORD_DESKTOP) VencordNative.tray.setUpdateState(isOutdated);
        if (!isOutdated) return;

        // Stage silently — no banner shown, update applies on next restart
        silentlyStageUpdate();
    } catch (err) {
        UpdateLogger.error("Failed to check for updates", err);
    }
}

function initTrayIpc() {
    if (IS_WEB || IS_UPDATER_DISABLED) return;

    VencordNative.tray.onCheckUpdates(async () => {
        try {
            const isOutdated = await checkForUpdates();
            VencordNative.tray.setUpdateState(isOutdated);

            if (isOutdated) {
                showNotice("A Guncord update is available!", "View Update", () => openSettingsTabModal(UpdaterTab!));
            } else {
                showNotice("No updates available, you're on the latest version!", "OK", popNotice);
            }
        } catch (err) {
            UpdateLogger.error("Failed to check for updates from tray", err);
            showNotice("Failed to check for updates, check the console for more info", "OK", popNotice);
        }
    });

    VencordNative.tray.onRepair(async () => {
        try {
            await update();
            relaunch();
        } catch (err) {
            UpdateLogger.error("Failed to repair Guncord", err);
        }
    });

    VencordNative.tray.setUpdateState(getIsOutdated);
}

import { ReactDOM } from "@webpack/common";

async function init() {
    await onceReady;

    startAllPlugins(StartAt.WebpackReady);
    initUserPluginsEngine();

    syncSettings();
    initTrayIpc();

    if (!IS_WEB && !IS_UPDATER_DISABLED) {
        setTimeout(runUpdateCheck, 8000);
        setInterval(runUpdateCheck, 1000 * 60 * 30); // 30 minutes
    }

    // Only notify when an update has actually been applied / on new version
    try {
        const currentVersion = `v1.27.4`;
        const LS_KEY = "guncord_installed_version";
        const lastVersion = localStorage.getItem(LS_KEY);

        if (lastVersion !== currentVersion) {
            localStorage.setItem(LS_KEY, currentVersion);
            setTimeout(() => {
                showNotification({
                    id: "guncord-update-notify",
                    title: "Guncord Updated",
                    body: `Guncord updated to ${currentVersion}. Open settings to discover what's new.`,
                    icon: "guncord",
                    type: "success",
                    duration: 6000,
                    actions: [
                        {
                            label: "Settings",
                            onClick: () => {
                                try { SettingsRouter.open("equicord_general"); } catch {}
                            }
                        }
                    ]
                });
            }, 1200);
        }
    } catch {}

    if (IS_DEV) {
        const pendingPatches = patches.filter(p => !p.all && p.predicate?.() !== false);
        if (pendingPatches.length)
            PMLogger.warn(
                "Webpack has finished initialising, but some patches haven't been applied yet.",
                "This might be expected since some Modules are lazy loaded, but please verify",
                "that all plugins are working as intended.",
                "You are seeing this warning because this is a Development build of Guncord.",
                "\nThe following patches have not been applied:",
                "\n\n" + pendingPatches.map(p => `${p.plugin}: ${p.find}`).join("\n")
            );
    }
}

if ((window as any).__GUNCORD_INITIALIZED__) {
    console.warn("[Guncord] Renderer already initialized — skipping duplicate execution.");
} else {
    (window as any).__GUNCORD_INITIALIZED__ = true;

    try {
        const g: any = typeof window !== "undefined" ? window : globalThis;
        g.Equicord = g.Vencord;
        g.Guncord = g.Vencord;
        g.VencordNative ??= g.EquicordNative ?? g.GuncordNative;
        g.EquicordNative ??= g.VencordNative;
        g.GuncordNative ??= g.VencordNative;
    } catch {}

    initPluginManager();
    initStyles();
    startAllPlugins(StartAt.Init);
    init();

    document.addEventListener("DOMContentLoaded", () => {
        startAllPlugins(StartAt.DOMContentLoaded);
    }, { once: true });
}


