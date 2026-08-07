/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Command } from "@vencord/discord-types";
export { ApplicationCommandInputType, ApplicationCommandOptionType, ApplicationCommandType } from "@vencord/discord-types/enums";

export interface VencordCommand extends Command {
    isVencordCommand?: boolean;
}
