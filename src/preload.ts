/*
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

import { debounce } from "@shared/debounce";
import { IpcEvents } from "@shared/IpcEvents";
import { contextBridge, webFrame } from "electron/renderer";

import VencordNative, { invoke, sendSync } from "./VencordNative";

contextBridge.exposeInMainWorld("VencordNative", VencordNative);
contextBridge.exposeInMainWorld("EquicordNative", VencordNative);
contextBridge.exposeInMainWorld("GuncordNative", VencordNative);

// Discord
if (location.protocol !== "data:") {
    invoke(IpcEvents.INIT_FILE_WATCHERS);

    if (IS_DISCORD_DESKTOP) {
        try {
            const uId = process.env.GUNCORD_INSTANCE_USER ||
                process.argv.find(a => a.startsWith("--guncord-instance-user="))?.split("=")[1];
            if (uId) {
                const fs = require("original-fs");
                const path = require("path");
                const instanceDir = process.env.GUNCORD_INSTANCE_DIR || path.join(process.resourcesPath, "..", "..", `Guncord-Instance-${uId}`);
                const possiblePaths = [
                    path.join(instanceDir, "guncord-instance.json"),
                    path.join(instanceDir, "discord", "guncord-instance.json")
                ];
                let cfg: any = null;
                for (const p of possiblePaths) {
                    if (fs.existsSync(p)) {
                        try {
                            cfg = JSON.parse(fs.readFileSync(p, "utf-8"));
                            break;
                        } catch {}
                    }
                }
                if (cfg?.token) {
                    const tokLit = JSON.stringify(cfg.token);
                    const uidLit = JSON.stringify(cfg.userId || uId);
                    webFrame.executeJavaScript(`(function(){
                        try {
                            var raw = ${tokLit};
                            var q = JSON.stringify(raw);
                            localStorage.setItem("token", q);
                            localStorage.setItem("default_token", q);
                            localStorage.setItem("user_id_cache", JSON.stringify(${uidLit}));
                            Object.defineProperty(window, "__guncord_token", { value: raw, writable: false, configurable: true });
                            Object.defineProperty(window, "__guncord_user_id", { value: ${uidLit}, writable: false, configurable: true });
                        } catch(e) {}
                    })()`);
                }
            }
        } catch (e) {
            console.error("[GuncordMI] preload token injection error:", e);
        }

        webFrame.executeJavaScript(sendSync<string>(IpcEvents.PRELOAD_GET_RENDERER_JS));
        if (process.env.DISCORD_PRELOAD) {
            try {
                require(process.env.DISCORD_PRELOAD);
            } catch (e) {
                console.error("[Guncord] Error loading original Discord preload:", e);
            }
        }
    }
} // Monaco popout
else {
    contextBridge.exposeInMainWorld("setCss", debounce(VencordNative.quickCss.set));
    contextBridge.exposeInMainWorld("getCurrentCss", VencordNative.quickCss.get);
    contextBridge.exposeInMainWorld("getTheme", VencordNative.quickCss.getEditorTheme);
}
