/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByProps, findByPropsLazy, findComponentByCodeLazy, findStoreLazy } from "@webpack";
import {
    FluxDispatcher,
    MessageActions,
    React,
    useStateFromStores,
} from "@webpack/common";

const MessageStore = findStoreLazy("MessageStore");

const SUPPORTED_CHANNEL_TYPES = [0, 5, 1, 3, 11, 12, 2, 13];

const settings = definePluginSettings({
    displayOn: {
        type: OptionType.SELECT,
        description: "When to display the preview",
        options: [
            { label: "Hover", value: "hover", default: true },
            { label: "Shift + Hover", value: "shift-hover" },
            { label: "Mouse Wheel Click", value: "mwheel" },
        ],
    },
    hoverDelay: {
        type: OptionType.SLIDER,
        description: "Delay before showing preview on hover (seconds)",
        default: 0.4,
        markers: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.5, 2.0],
        stickToMarkers: true,
    },
    messagesCount: {
        type: OptionType.SLIDER,
        description: "Maximum number of messages to show",
        default: 20,
        markers: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
        stickToMarkers: true,
    },
    popoutHeight: {
        type: OptionType.SLIDER,
        description: "Preview height (% of Discord window)",
        default: 40,
        markers: [10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90],
        stickToMarkers: true,
    },
    displayMode: {
        type: OptionType.SELECT,
        description: "Message display mode",
        options: [
            { label: "Cozy", value: "cozy", default: true },
            { label: "Compact", value: "compact" },
        ],
    },
    nsfw: {
        type: OptionType.SELECT,
        description: "NSFW channel behaviour",
        options: [
            { label: "Show", value: "show" },
            { label: "Obscure media", value: "obscure", default: true },
            { label: "Don't show", value: "hide" },
        ],
    },
    typingUsers: {
        type: OptionType.BOOLEAN,
        description: "Show typing users in preview",
        default: true,
    },
    darkenChat: {
        type: OptionType.BOOLEAN,
        description: "Darken chat behind the preview",
        default: true,
    },
});

// Store to track which channel previews should be shown
const shownPreviews = new Set<string>();
const shouldShowPreviews = new Set<string>();

export default definePlugin({
    name: "ChannelsPreview",
    description: "Allows you to view recent messages in channels without switching to it. Hover over a channel to preview its recent messages.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    settings,

    patches: [
        {
            // Patch channel links to add hover preview
            find: "hasActiveThreads",
            noWarn: true,
            replacement: {
                match: /onMouseEnter:(\i),onMouseLeave:(\i)/,
                replace: "onMouseEnter:$self.wrapMouseEnter($1,arguments[0]),onMouseLeave:$self.wrapMouseLeave($2,arguments[0])"
            }
        }
    ],

    _timeouts: new Map<string, ReturnType<typeof setTimeout>>(),

    showPreview(channelId: string) {
        if (!SUPPORTED_CHANNEL_TYPES.length) return;
        shouldShowPreviews.add(channelId);
        FluxDispatcher.dispatch({ type: "CP__PREVIEW_SHOULD_SHOW", channelId });
    },

    hidePreview(channelId: string) {
        const t = this._timeouts.get(channelId);
        if (t) { clearTimeout(t); this._timeouts.delete(channelId); }
        shouldShowPreviews.delete(channelId);
        FluxDispatcher.dispatch({ type: "CP__PREVIEW_SHOULD_HIDE", channelId });
    },

    wrapMouseEnter(original: any, props: any) {
        const channelId = props?.channel?.id;
        if (!channelId) return original;
        return (...args: any[]) => {
            original?.(...args);
            if (settings.store.displayOn === "hover" || settings.store.displayOn === "shift-hover") {
                const delay = (settings.store.hoverDelay ?? 0.4) * 1000;
                const t = setTimeout(() => this.showPreview(channelId), delay);
                this._timeouts.set(channelId, t);
            }
        };
    },

    wrapMouseLeave(original: any, props: any) {
        const channelId = props?.channel?.id;
        if (!channelId) return original;
        return (...args: any[]) => {
            original?.(...args);
            this.hidePreview(channelId);
        };
    },

    start() {
        // Preload messages for hovered channels
        FluxDispatcher.subscribe("CP__PREVIEW_SHOULD_SHOW", ({ channelId }) => {
            const msgs = MessageStore.getMessages(channelId);
            if (msgs && msgs.length < settings.store.messagesCount) {
                MessageActions.fetchMessages({ channelId, limit: settings.store.messagesCount });
            }
        });
    },

    stop() {
        this._timeouts.forEach(t => clearTimeout(t));
        this._timeouts.clear();
    },
});
