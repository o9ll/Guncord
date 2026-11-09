/*
 * Guncord — Installer via EquilotlCli
 * Downloads EquilotlCli.exe from Equicord releases and runs it
 * with env vars pointing to Guncord files.
 *
 * The exe shows a GUI to pick the target Discord.
 *
 * Usage:
 *   pnpm inject    → installs Guncord into the chosen Discord
 *   pnpm uninject  → uninstalls Guncord from the chosen Discord
 *   pnpm repair    → repairs the installation
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./checkNodeVersion.js";

import { fork } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const BASE_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");

const argStart = process.argv.indexOf("--");
const args = argStart === -1 ? process.argv.slice(2) : process.argv.slice(argStart + 1);

const isUninstall = args.includes("--uninstall") || args.includes("-uninstall");
const targetScript = isUninstall
    ? join(BASE_DIR, "scripts", "uninject.mjs")
    : join(BASE_DIR, "scripts", "inject.mjs");

const child = fork(targetScript, args, { stdio: "inherit" });
child.on("exit", code => process.exit(code ?? 0));

