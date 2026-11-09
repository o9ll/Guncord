/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { existsSync, mkdirSync } from "fs";
import { join } from "path";

const banner = `/*
 * Guncord Mobile Bundle
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */\n`;

const outdir = join(process.cwd(), "dist", "mobile");
if (!existsSync(outdir)) {
    mkdirSync(outdir, { recursive: true });
}

console.log("[Guncord Mobile] Bundling React Native Hermes bundle with Bun...");

try {
    const result = await Bun.build({
        entrypoints: ["bundle/src/index.ts"],
        outdir,
        naming: "guncord.js",
        target: "browser",
        format: "iife",
        minify: false,
        banner
    });

    if (!result.success) {
        console.error("[Guncord Mobile] Build failed:");
        for (const log of result.logs) {
            console.error(log);
        }
        process.exit(1);
    }

    console.log(`[Guncord Mobile] Bundle generated successfully at: ${join(outdir, "guncord.js")}`);
} catch (e) {
    console.error("[Guncord Mobile] Build exception:", e);
    process.exit(1);
}

