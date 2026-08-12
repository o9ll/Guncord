/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginInfo } from "@guncordplugins/betterScreenshare.desktop/constants";
import { openScreenshareModal } from "@guncordplugins/betterScreenshare.desktop/modals";
import { ScreenshareAudioPatcher, ScreensharePatcher } from "@guncordplugins/betterScreenshare.desktop/patchers";
import { GoLivePanelWrapper, replacedSubmitFunction } from "@guncordplugins/betterScreenshare.desktop/patches";
import { initScreenshareAudioStore, initScreenshareStore } from "@guncordplugins/betterScreenshare.desktop/stores";
import { addSettingsPanelButton, Emitter, removeSettingsPanelButton, ScreenshareSettingsIcon } from "@guncordplugins/pluginLibrary";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "BetterScreenshare",
    description: "Fully customise your screen share: resolution, framerate, bitrate, keyframe interval, HDR and audio — with saveable profiles, in a redesigned panel.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    dependencies: ["PluginLibrary"],
    patches: [
        {
            find: ':"go-live-modal"',
            replacement: {
                match: /function (\i)\((.{1,20})\)\{.{0,300}null==.{0,50}\?(\(0,.{1,10}\.jsxs?\)\(.{1,50}\..{1,10},{).{0,500}channel:.{0,20}}}\)/,
                replace: "$self.GoLivePanelWrapper($1,$2,$3)"
            }
        },
        {
            find: ".STREAM_FPS_OPTION.",
            replacement: {
                match: /,onSubmit:function\(\){/,
                replace: ",onSubmit:function(){$self.replacedSubmitFunction(arguments[0]);"
            }
        }
    ],
    start(): void {
        initScreenshareStore();
        initScreenshareAudioStore();

        this.screensharePatcher = new ScreensharePatcher().patch();
        this.screenshareAudioPatcher = new ScreenshareAudioPatcher().patch();

        addSettingsPanelButton({
            name: PluginInfo.PLUGIN_NAME,
            icon: ScreenshareSettingsIcon,
            get tooltipText() { return "Screenshare settings · BetterScreenshare"; },
            onClick: openScreenshareModal
        });
    },
    stop(): void {
        this.screensharePatcher?.unpatch();
        this.screenshareAudioPatcher?.unpatch();

        Emitter.removeAllListeners(PluginInfo.PLUGIN_NAME);

        removeSettingsPanelButton(PluginInfo.PLUGIN_NAME);
    },
    toolboxActions: {
        "Open Screenshare Settings": openScreenshareModal
    },
    GoLivePanelWrapper,
    replacedSubmitFunction
});
