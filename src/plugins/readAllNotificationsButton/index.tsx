/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { addServerListElement, removeServerListElement, ServerListItem, ServerListRenderPosition } from "@api/ServerList";
import { definePluginSettings } from "@api/Settings";
import { TextButton } from "@components/Button";
import ErrorBoundary from "@components/ErrorBoundary";
import { DoubleCheckmarkIcon } from "@components/Icons";
import { Devs, EquicordDevs } from "@utils/constants";
import definePlugin, { OptionType } from "@utils/types";
import { ActiveJoinedThreadsStore, FluxDispatcher, GuildChannelStore, GuildStore, React, ReadStateStore } from "@webpack/common";

const settings = definePluginSettings({
    compact: {
        type: OptionType.BOOLEAN,
        default: false,
        description: "Show a small text button instead of a server list icon"
    }
});

function onClick() {
    const channels: Array<any> = [];

    Object.values(GuildStore.getGuilds()).forEach(guild => {
        GuildChannelStore.getChannels(guild.id).SELECTABLE
            .concat(GuildChannelStore.getChannels(guild.id).VOCAL)
            .concat(
                Object.values(ActiveJoinedThreadsStore.getActiveJoinedThreadsForGuild(guild.id))
                    .flatMap(threadChannels => Object.values(threadChannels))
            )
            .forEach((c: { channel: { id: string; }; }) => {
                if (!ReadStateStore.hasUnread(c.channel.id)) return;

                channels.push({
                    channelId: c.channel.id,
                    messageId: ReadStateStore.lastMessageId(c.channel.id),
                    readStateType: 0
                });
            });
    });

    FluxDispatcher.dispatch({
        type: "BULK_ACK",
        context: "APP",
        channels: channels
    });
}

function ReadAllButton() {
    const { compact } = settings.use(["compact"]);

    return compact ? (
        <TextButton
            variant="secondary"
            onClick={onClick}
            className="vc-ranb-button"
        >
            Read All
        </TextButton>
    ) : (
        <ServerListItem
            id="vc-ranb-button-container"
            icon={DoubleCheckmarkIcon}
            tooltip="Read All"
            onClick={onClick}
        />
    );
}

export default definePlugin({
    name: "ReadAllNotificationsButton",
    description: "Read all server notifications with a single button click!",
    tags: ["Notifications", "Shortcuts"],
    authors: [Devs.kemo, EquicordDevs.KrystalSkull],
    dependencies: ["ServerListAPI"],
    settings,

    renderReadAllButton: ErrorBoundary.wrap(ReadAllButton, { noop: true }),

    start() {
        addServerListElement(ServerListRenderPosition.Above, this.renderReadAllButton);
    },

    stop() {
        removeServerListElement(ServerListRenderPosition.Above, this.renderReadAllButton);
    }
});
