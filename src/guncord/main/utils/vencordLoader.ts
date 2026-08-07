/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync } from "fs";
import { join } from "path";

import { USER_AGENT } from "../constants";
import { VENCORD_DIR } from "../vencordDir";
import { downloadFile, fetchie } from "./http";

const API_BASE = "https://api.github.com";

export interface ReleaseData {
    name: string;
    tag_name: string;
    html_url: string;
    assets: Array<{
        name: string;
        browser_download_url: string;
    }>;
}

export async function githubGet(endpoint: string) {
    const opts: RequestInit = {
        headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": USER_AGENT
        }
    };

    return fetchie(API_BASE + endpoint, opts, { retryOnNetworkError: true });
}

export async function downloadVencordAsar() {
    await downloadFile(
        "https://github.com/o9ll/Guncord/releases/latest/download/Guncord.asar",
        VENCORD_DIR,
        {},
        { retryOnNetworkError: true }
    );
}

export function isValidVencordInstall(dir: string) {
    return existsSync(join(dir, "Guncord/main.js"));
}

export async function ensureVencordFiles() {
    if (!existsSync(VENCORD_DIR)) {
        console.error("Bundled guncord.asar not found at", VENCORD_DIR);
    }
}
