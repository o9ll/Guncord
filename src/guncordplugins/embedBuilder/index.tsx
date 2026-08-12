/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, ApplicationCommandOptionType, findOption, sendBotMessage } from "@api/Commands";
import { definePluginSettings } from "@api/Settings";
import { copyToClipboard } from "@utils/clipboard";
import definePlugin, { OptionType } from "@utils/types";

const settings = definePluginSettings({
    defaultColor: {
        type: OptionType.STRING,
        description: "Default embed color (hex format, e.g. #5865F2).",
        default: "#5865F2"
    },
    autoCopy: {
        type: OptionType.BOOLEAN,
        description: "Automatically copy the generated JSON to the clipboard.",
        default: true
    }
});

function hexToDecimal(hex: string): number {
    return parseInt(hex.replace("#", ""), 16);
}

function reply(channelId: string, json: string) {
    if (settings.store.autoCopy) copyToClipboard(json);

    const note = settings.store.autoCopy
        ? "✅ Copied to clipboard! Paste into https://discohook.org/"
        : "Copy this JSON and paste into https://discohook.org/";

    sendBotMessage(channelId, { content: `\`\`\`json\n${json}\n\`\`\`\n${note}` });
}

export default definePlugin({
    name: "EmbedBuilder",
    enabledByDefault: false,
    description: "Generate embed JSON quickly for use with webhooks or bots.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    tags: ["Chat", "Utility"],
    settings,
    commands: [
        {
            name: "embedbuild",
            description: "Generate embed JSON",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "title", description: "Embed title", type: ApplicationCommandOptionType.STRING, required: true },
                { name: "description", description: "Embed description", type: ApplicationCommandOptionType.STRING, required: true },
                { name: "color", description: "Embed color (hex format, e.g. #FF0000)", type: ApplicationCommandOptionType.STRING, required: false },
                { name: "image", description: "Image URL", type: ApplicationCommandOptionType.STRING, required: false },
                { name: "thumbnail", description: "Thumbnail URL", type: ApplicationCommandOptionType.STRING, required: false },
                { name: "footer", description: "Footer text", type: ApplicationCommandOptionType.STRING, required: false }
            ],
            execute: async (args, ctx) => {
                const image = findOption(args, "image", "");
                const thumbnail = findOption(args, "thumbnail", "");
                const footer = findOption(args, "footer", "");

                const embed: Record<string, unknown> = {
                    title: findOption(args, "title", ""),
                    description: findOption(args, "description", ""),
                    color: hexToDecimal(findOption(args, "color", settings.store.defaultColor)),
                    timestamp: new Date().toISOString()
                };

                if (image) embed.image = { url: image };
                if (thumbnail) embed.thumbnail = { url: thumbnail };
                if (footer) embed.footer = { text: footer };

                reply(ctx.channel.id, JSON.stringify({ embeds: [embed] }, null, 2));
            }
        },
        {
            name: "embedfield",
            description: "Generate embed JSON with fields",
            inputType: ApplicationCommandInputType.BUILT_IN,
            options: [
                { name: "title", description: "Embed title", type: ApplicationCommandOptionType.STRING, required: true },
                { name: "fields", description: "Fields (format: Name1:Value1|Name2:Value2)", type: ApplicationCommandOptionType.STRING, required: true },
                { name: "color", description: "Embed color (hex format)", type: ApplicationCommandOptionType.STRING, required: false }
            ],
            execute: async (args, ctx) => {
                const fields = findOption(args, "fields", "").split("|").map(field => {
                    const [name, value] = field.split(":");
                    return { name: name?.trim() || "Field", value: value?.trim() || "Value", inline: false };
                });

                const embed = {
                    title: findOption(args, "title", ""),
                    fields,
                    color: hexToDecimal(findOption(args, "color", settings.store.defaultColor)),
                    timestamp: new Date().toISOString()
                };

                reply(ctx.channel.id, JSON.stringify({ embeds: [embed] }, null, 2));
            }
        }
    ]
});
