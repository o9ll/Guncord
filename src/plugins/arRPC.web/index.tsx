/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { popNotice, showNotice } from "@api/Notices";
import { migratePluginSettings } from "@api/Settings";
import { Heading } from "@components/Heading";
import { Link } from "@components/Link";
import { Margins } from "@components/margins";
import { Paragraph } from "@components/Paragraph";
import { Devs } from "@utils/constants";
import definePlugin, { ReporterTestable } from "@utils/types";
import { ApplicationAssetUtils, fetchApplicationsRPC, FluxDispatcher, showToast } from "@webpack/common";

async function lookupAsset(applicationId: string, key: string): Promise<string> {
    return (await ApplicationAssetUtils.fetchAssetIds(applicationId, [key]))[0];
}

const apps: any = {};
async function lookupApp(applicationId: string): Promise<string> {
    const socket: any = {};
    await fetchApplicationsRPC(socket, applicationId);
    return socket.application;
}

let ws: WebSocket;

migratePluginSettings("WebRichPresence", "WebRichPresence (arRPC)");
export default definePlugin({
    name: "WebRichPresence",
    description: "Client plugin for arRPC to enable RPC on Discord Web (experimental)",
    tags: ["Activity", "Utility"],
    authors: [Devs.Ducko],
    reporterTestable: ReporterTestable.None,
    hidden: IS_EQUIBOP || IS_VESKTOP || "legcord" in window,

    settingsAboutComponent: () => (
        <>
            <Heading className={Margins.bottom8}>How to use arRPC</Heading>
            <Paragraph>
                <Link href="https://github.com/OpenAsar/arrpc/tree/main#server">Follow the instructions in the GitHub repo</Link> to get the server running, and then enable the plugin.
            </Paragraph>
        </>
    ),

    async handleEvent(e: MessageEvent<any>) {
        const data = JSON.parse(e.data);

        const { activity } = data;
        const assets = activity?.assets;

        if (assets?.large_image) assets.large_image = await lookupAsset(activity.application_id, assets.large_image);
        if (assets?.small_image) assets.small_image = await lookupAsset(activity.application_id, assets.small_image);

        if (activity) {
            const appId = activity.application_id;
            apps[appId] ||= await lookupApp(appId);

            const app = apps[appId];
            activity.name ||= app.name;
        }

        FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", ...data });
    },

    async start() {
        if (ws) ws.close();
        ws = new WebSocket("ws://127.0.0.1:1337"); // try to open WebSocket

        ws.onmessage = this.handleEvent;

        const connectionSuccessful = await new Promise(res => setTimeout(() => res(ws.readyState === WebSocket.OPEN), 5000)); // check if open after 5s
        if (!connectionSuccessful) {
            showNotice("Failed to connect to arRPC, is it running?", "Retry", () => {
                // show notice about failure to connect, with retry/ignore
                popNotice();
                this.start();
            });
            return;
        }

        showToast({ text: "Connected to arRPC", variant: "success" });
    },

    stop() {
        FluxDispatcher.dispatch({ type: "LOCAL_ACTIVITY_UPDATE", activity: null }); // clear status
        ws?.close(); // close WebSocket
    }
});
