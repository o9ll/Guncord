/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("worldBombAPI", {
    sequence: (word, lps, humanChance) =>
        ipcRenderer.invoke("WorldBombSequence", word, lps, humanChance),
    closeWindow: () =>
        ipcRenderer.send("WorldBombCloseWindow"),
    setStreamProof: (enabled) =>
        ipcRenderer.send("WorldBombSetStreamProof", enabled),
    resize: (width, height) =>
        ipcRenderer.send("WorldBombResizeWindow", width, height)
});
