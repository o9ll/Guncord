/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { dialog, IpcMainInvokeEvent } from "electron";
import { writeFile, mkdir } from "node:fs/promises";
import * as path from "node:path";

/**
 * Opens a native folder picker via Electron dialog.
 */
export async function pickDirectory(_event: IpcMainInvokeEvent): Promise<string | null> {
    const res = await dialog.showOpenDialog({
        title: "Choose Save Folder",
        properties: ["openDirectory", "createDirectory"]
    });

    if (res.canceled || !res.filePaths.length) return null;
    return res.filePaths[0];
}

/**
 * Saves the recording buffer directly to the specified folder.
 */
export async function saveRecording(_event: IpcMainInvokeEvent, buffer: Uint8Array, folderPath: string, filename: string): Promise<boolean> {
    try {
        await mkdir(folderPath, { recursive: true });
        const dest = path.join(folderPath, filename);
        await writeFile(dest, buffer);
        return true;
    } catch (e) {
        console.error("Failed to save recording natively:", e);
        return false;
    }
}

/**
 * Prompts the user with a Save As dialog, then saves the buffer.
 */
export async function promptSaveRecording(_event: IpcMainInvokeEvent, buffer: Uint8Array, defaultFilename: string): Promise<boolean> {
    try {
        const res = await dialog.showSaveDialog({
            title: "Save Call Recording",
            defaultPath: defaultFilename,
            filters: [
                { name: "Video/Audio", extensions: ["webm", "ogg"] },
                { name: "All Files", extensions: ["*"] }
            ]
        });

        if (res.canceled || !res.filePath) return false;
        
        await writeFile(res.filePath, buffer);
        return true;
    } catch (e) {
        console.error("Failed to prompt save recording natively:", e);
        return false;
    }
}
