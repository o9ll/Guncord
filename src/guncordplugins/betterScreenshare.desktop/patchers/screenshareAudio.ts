/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginInfo } from "@guncordplugins/betterScreenshare.desktop/constants";
import { logger } from "@guncordplugins/betterScreenshare.desktop/logger";
import { screenshareAudioStore } from "@guncordplugins/betterScreenshare.desktop/stores/screenshareAudioStore";
import { Emitter, MediaEngineStore, patchConnectionAudioTransportOptions, Patcher, types } from "@guncordplugins/pluginLibrary";
import { UserStore } from "@webpack/common";

export class ScreenshareAudioPatcher extends Patcher {
    private mediaEngineStore: types.MediaEngineStore;
    private mediaEngine: types.MediaEngine;
    public connection?: types.Connection;

    public oldSetTransportOptions: (...args: any[]) => void;
    public forceUpdateTransportationOptions: () => void;

    constructor() {
        super();
        this.mediaEngineStore = MediaEngineStore;
        this.mediaEngine = this.mediaEngineStore.getMediaEngine();

        this.forceUpdateTransportationOptions = () => void 0;
        this.oldSetTransportOptions = () => void 0;
    }

    public patch(): this {
        this.unpatch();

        const { get } = screenshareAudioStore;

        const connectionEventFunction =
            (connection: types.Connection) => {
                if (connection.context !== "stream" || connection.streamUserId !== UserStore.getCurrentUser().id) return;

                this.connection = connection;

                const {
                    forceUpdateTransportationOptions: forceUpdateTransportationOptionsAudio,
                    oldSetTransportOptions: oldSetTransportOptionsAudio
                } = patchConnectionAudioTransportOptions(connection, get, logger);

                this.forceUpdateTransportationOptions = forceUpdateTransportationOptionsAudio;
                this.oldSetTransportOptions = oldSetTransportOptionsAudio;

                Emitter.addListener(connection.emitter, "on", "connected", () => {
                    this.forceUpdateTransportationOptions();
                });

                Emitter.addListener(connection.emitter, "on", "destroy", () => {
                    this.forceUpdateTransportationOptions = () => void 0;
                });
            };

        Emitter.addListener(
            this.mediaEngine.emitter,
            "on",
            "connection",
            connectionEventFunction,
            PluginInfo.PLUGIN_NAME
        );

        return this;
    }

    public unpatch(): this {
        return this._unpatch();
    }
}
