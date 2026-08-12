/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

import { EvilCommand } from "./commands/Evil";
import { CommandManager } from "./reversedcodes/command/CommandManager";

const commandManager = new CommandManager();
commandManager.registerCommand(new EvilCommand());

export default definePlugin({
    name: "EvilMod",
    description: "Evil Mod is a Discord Vencord plugin that can be used to conduct social engineering or hacking attacks.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    tags: ["Chat", "Fun"],
    enabledByDefault: false,
    commands: commandManager.getRegisteredCommands(),
});