/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, unlinkSync, copyFileSync } from "original-fs";
import { dirname, join } from "path";

function findUpdateSourceDir(baseDir: string): string {
    if (existsSync(join(baseDir, "patcher.js")) || existsSync(join(baseDir, "renderer.js"))) {
        return baseDir;
    }
    if (existsSync(join(baseDir, "dist", "desktop", "patcher.js"))) {
        return join(baseDir, "dist", "desktop");
    }
    if (existsSync(join(baseDir, "dist", "patcher.js"))) {
        return join(baseDir, "dist");
    }
    if (existsSync(join(baseDir, "desktop", "patcher.js"))) {
        return join(baseDir, "desktop");
    }
    return baseDir;
}

export function copyDirectorySync(src: string, dest: string): boolean {
    try {
        if (!existsSync(dest)) mkdirSync(dest, { recursive: true });
        const effectiveSrc = findUpdateSourceDir(src);
        const entries = readdirSync(effectiveSrc, { withFileTypes: true });

        for (const entry of entries) {
            const srcPath = join(effectiveSrc, entry.name);
            const destPath = join(dest, entry.name);

            if (entry.isDirectory()) {
                copyDirectorySync(srcPath, destPath);
            } else {
                try {
                    copyFileSync(srcPath, destPath);
                } catch (err: any) {
                    console.warn(`[GuncordUpdater] Could not copy ${entry.name} immediately:`, err.message);
                }
            }
        }
        return true;
    } catch (err: any) {
        console.error("[GuncordUpdater] Failed to copy directory:", err);
        return false;
    }
}

/**
 * Synchronously checks and applies any staged Guncord update on startup
 * before any renderer/preload resources are loaded or locked by Electron.
 */
export function applyPendingUpdateOnStartup() {
    try {
        const candidatePaths = [
            join(__dirname, "guncord-pending-update.json"),
            join(__dirname, "..", "guncord-pending-update.json"),
            join(__dirname, "..", "..", "guncord-pending-update.json")
        ];

        const markerPath = candidatePaths.find(p => existsSync(p));
        if (!markerPath) return;

        console.log("[GuncordUpdater] Found pending update marker at:", markerPath);

        let marker: { version?: string; stagingDir?: string; destDir?: string; };
        try {
            marker = JSON.parse(readFileSync(markerPath, "utf-8"));
        } catch {
            try { unlinkSync(markerPath); } catch {}
            return;
        }

        const stagingDir = marker.stagingDir;
        const destDir = marker.destDir || __dirname;

        if (stagingDir && existsSync(stagingDir)) {
            console.log(`[GuncordUpdater] Applying pending update (${marker.version ?? "latest"}) from ${stagingDir} -> ${destDir}`);
            copyDirectorySync(stagingDir, destDir);
            console.log("[GuncordUpdater] Pending update applied successfully!");
            try { rmSync(stagingDir, { recursive: true, force: true }); } catch {}
        }

        try { unlinkSync(markerPath); } catch {}
    } catch (err) {
        console.error("[GuncordUpdater] Error applying pending update on startup:", err);
    }
}

