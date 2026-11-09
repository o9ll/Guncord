/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { addMessageAccessory } from "@api/MessageAccessories";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore } from "@webpack/common";

import { convert } from "./converter";
import { conversions, ConverterAccessory, ConvertIcon } from "./ConverterAccessory";

export const settings = definePluginSettings({
    myUnits: {
        type: OptionType.SELECT,
        description: "the units you use and want things converted to. defaults to imperial",
        options: [
            {
                default: true,
                label: "Imperial",
                value: "imperial",
            },
            {
                label: "Metric",
                value: "metric"
            }
        ]
    },
});

export default definePlugin({
    name: "UnitConverter",
    description: "Converts metric units to Imperal units and vice versa",
    dependencies: ["MessagePopoverAPI"],
    tags: ["Utility"],
    authors: [Devs.sadan],
    messagePopoverButton: {
        icon: ConvertIcon,
        render(message) {
            if (!message.content) return null;
            return {
                label: "Convert Units",
                icon: ConvertIcon,
                message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: async () => {
                    const setConversion = conversions.get(message.id);
                    if (!setConversion) return;
                    setConversion(convert(message.content));
                }
            };
        }
    },
    start() {
        addMessageAccessory("vc-converter", props => <ConverterAccessory message={props.message} />);
    },
    settings,
});
