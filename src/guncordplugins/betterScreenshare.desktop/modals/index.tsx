/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ScreenshareAudioModal } from "@guncordplugins/betterScreenshare.desktop/ScreenshareAudioModal";
import { ScreenshareModal } from "@guncordplugins/betterScreenshare.desktop/ScreenshareModal";
import { screenshareAudioStore, screenshareStore } from "@guncordplugins/betterScreenshare.desktop/stores";
import { openModalLazy } from "@utils/modal";

import Plugin from "..";

const onScreenshareModalDone = () => {
    const { screenshareAudioPatcher, screensharePatcher } = Plugin;

    if (screensharePatcher) {
        screensharePatcher.forceUpdateTransportationOptions();
        screensharePatcher.forceUpdateDesktopSourceOptions();
    }
    if (screenshareAudioPatcher)
        screenshareAudioPatcher.forceUpdateTransportationOptions();
};

const onScreenshareAudioModalDone = () => {
    const { screenshareAudioPatcher } = Plugin;
    if (screenshareAudioPatcher)
        screenshareAudioPatcher.forceUpdateTransportationOptions();
};

export const openScreenshareAudioModal =
    () => openModalLazy(async () => {
        return props =>
            <ScreenshareAudioModal
                rootProps={props}
                screenshareAudioStore={screenshareAudioStore}
                onDone={onScreenshareAudioModalDone} />;
    });

export const openScreenshareModal =
    () => openModalLazy(async () => {
        return props =>
            <ScreenshareModal
                rootProps={props}
                screenshareStore={screenshareStore}
                onDone={onScreenshareModalDone}
                onOpenAudio={openScreenshareAudioModal} />;
    });
