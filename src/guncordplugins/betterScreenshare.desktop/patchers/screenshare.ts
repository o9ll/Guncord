/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PluginInfo } from "@guncordplugins/betterScreenshare.desktop/constants";
import { logger } from "@guncordplugins/betterScreenshare.desktop/logger";
import { screenshareStore } from "@guncordplugins/betterScreenshare.desktop/stores";
import { Emitter, MediaEngineStore, Patcher, types } from "@guncordplugins/pluginLibrary";
import { patchConnectionVideoSetDesktopSourceWithOptions, patchConnectionVideoTransportOptions } from "@guncordplugins/pluginLibrary/patches/video";
import { UserStore } from "@webpack/common";

export class ScreensharePatcher extends Patcher {
    private mediaEngineStore: types.MediaEngineStore;
    private mediaEngine: types.MediaEngine;
    public connection?: types.Connection;
    public oldSetDesktopSourceWithOptions: (...args: any[]) => void;
    public oldSetTransportOptions: (...args: any[]) => void;
    public forceUpdateTransportationOptions: () => void;
    public forceUpdateDesktopSourceOptions: () => void;

    constructor() {
        super();
        this.mediaEngineStore = MediaEngineStore;
        this.mediaEngine = this.mediaEngineStore.getMediaEngine();
        this.forceUpdateTransportationOptions = () => void 0;
        this.forceUpdateDesktopSourceOptions = () => void 0;
        this.oldSetDesktopSourceWithOptions = () => void 0;
        this.oldSetTransportOptions = () => void 0;
    }

    public patch(): this {
        this.unpatch();

        const { get } = screenshareStore;

        const connectionEventFunction =
            (connection: types.Connection) => {
                if (!(connection.context === "stream" && connection.streamUserId === UserStore.getCurrentUser().id)) return;

                this.connection = connection;

                const {
                    oldSetDesktopSourceWithOptions,
                    oldSetTransportOptions,
                    forceUpdateDesktopSourceOptions,
                    forceUpdateTransportationOptions
                } = {
                    ...patchConnectionVideoTransportOptions(connection, get, logger),
                    ...patchConnectionVideoSetDesktopSourceWithOptions(connection, get, logger)
                };

                this.oldSetDesktopSourceWithOptions = oldSetDesktopSourceWithOptions;
                this.oldSetTransportOptions = oldSetTransportOptions;
                this.forceUpdateDesktopSourceOptions = forceUpdateDesktopSourceOptions;
                this.forceUpdateTransportationOptions = forceUpdateTransportationOptions;

                Emitter.addListener(connection.emitter, "on", "connected", () => {
                    this.forceUpdateTransportationOptions();
                    this.forceUpdateDesktopSourceOptions();
                });

                Emitter.addListener(connection.emitter, "on", "destroy", () => {
                    this.forceUpdateTransportationOptions = () => void 0;
                    this.forceUpdateDesktopSourceOptions = () => void 0;
                    this.oldSetTransportOptions = () => void 0;
                    this.oldSetDesktopSourceWithOptions = () => void 0;
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
