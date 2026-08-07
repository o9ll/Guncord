/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { FluxDispatcher, UserStore } from "@webpack/common";

const MessageActions = findByPropsLazy("deleteMessage", "startEditMessage", "_sendMessage");

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable AntiLog double-click delete",
        default: true
    },
    emptyMessage: {
        type: OptionType.BOOLEAN,
        description: "Send an empty (invisible) message in place of the deleted one",
        default: true
    },
    blockMessage: {
        type: OptionType.STRING,
        description: "Text to send instead if empty message is disabled",
        default: "x"
    },
    deleteInterval: {
        type: OptionType.NUMBER,
        description: "Delay between deleting old and new message (ms) - for AntiLog",
        default: 200,
        min: 100,
        max: 5000
    },
    requireModifier: {
        type: OptionType.BOOLEAN,
        description: "Require Shift or Ctrl on double-click",
        default: false
    },
    showNotification: {
        type: OptionType.BOOLEAN,
        description: "Show a notification on delete",
        default: false
    }
});

async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendReplacementMessage(channelId: string, content: string, nonce: string): Promise<string | null> {
    if (!MessageActions?._sendMessage) {
        console.error("[DoubleClickAntiLog] MessageActions._sendMessage is not available");
        return null;
    }

    return new Promise(resolve => {
        // Listen for MESSAGE_CREATE to get the replacement message ID
        const messageCreateListener = (event: any) => {
            const message = event?.message;
            if (message && message.channel_id === channelId && message.nonce === nonce) {
                FluxDispatcher.unsubscribe("MESSAGE_CREATE", messageCreateListener);
                resolve(message.id);
            }
        };

        FluxDispatcher.subscribe("MESSAGE_CREATE", messageCreateListener);

        // Timeout after 5 seconds to avoid waiting forever
        setTimeout(() => {
            FluxDispatcher.unsubscribe("MESSAGE_CREATE", messageCreateListener);
            resolve(null);
        }, 5000);

        try {
            // Use _sendMessage with the nonce to replace the message in cacheSentMessages
            MessageActions._sendMessage(channelId, {
                content: content,
                tts: false,
                invalidEmojis: [],
                validNonShortcutEmojis: []
            }, { nonce: nonce });
        } catch (error) {
            FluxDispatcher.unsubscribe("MESSAGE_CREATE", messageCreateListener);
            console.error("[DoubleClickAntiLog] Error sending replacement message:", error);
            resolve(null);
        }
    });
}

function messageDeleteWrapper(channelId: string, messageId: string) {
    if (!MessageActions?.deleteMessage) {
        console.error("[DoubleClickAntiLog] MessageActions.deleteMessage is not available");
        return;
    }
    try {
        MessageActions.deleteMessage(channelId, messageId);
    } catch (error) {
        console.error("[DoubleClickAntiLog] Error during deletion:", error);
    }
}

async function performAntiLogDeletion(messageId: string, channelId: string, blockMessage: string, deleteInterval: number) {
    try {
        // Verify MessageActions is available
        if (!MessageActions?.deleteMessage || !MessageActions?._sendMessage) {
            console.error("[DoubleClickAntiLog] MessageActions is not available");
            return false;
        }

        // STEP 1: Dispatch MESSAGE_DELETE with mlDeleted: true so MessageLogger and MessageLoggerEnhanced ignore it
        FluxDispatcher.dispatch({
            type: "MESSAGE_DELETE",
            channelId: channelId,
            id: messageId,
            mlDeleted: true
        });

        // Small delay for the event to be processed
        await sleep(100);

        // STEP 2: Send a replacement message with the same nonce as the original
        // This replaces the message in MessageLoggerEnhanced's cache (cacheSentMessages) via the nonce glitch
        const replacementMessageId = await sendReplacementMessage(channelId, blockMessage, messageId);

        // Delay between sending and deleting (minimum 1 second)
        const deleteDelay = Math.max(deleteInterval, 1000);
        await sleep(deleteDelay);

        // STEP 3: Delete the original message
        messageDeleteWrapper(channelId, messageId);

        // STEP 4: Delete the replacement message after a delay
        if (replacementMessageId) {
            await sleep(deleteDelay);
            messageDeleteWrapper(channelId, replacementMessageId);
        }

        return true;
    } catch (error) {
        console.error("[DoubleClickAntiLog] Error during AntiLog deletion:", error);
        return false;
    }
}

export default definePlugin({
    name: "DoubleClickAntiLog",
    description: "Double-click your messages to delete with AntiLog (hides from MessageLogger)",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    dependencies: ["MessageEventsAPI"],
    settings,

    onMessageClick(msg: any, channel: any, event: MouseEvent) {
        try {
            // Check if plugin is enabled
            if (!settings.store.enabled) return;

            // Check if it's a double-click
            if (!event || event.detail !== 2) return;

            // Check if modifier key is required
            if (settings.store.requireModifier && !event.ctrlKey && !event.shiftKey) return;

            // Verify message and channel are valid
            if (!msg || !channel || !msg.id || !channel.id) return;

            // Check if it's our message
            const currentUser = UserStore.getCurrentUser();
            if (!currentUser || !msg.author || msg.author.id !== currentUser.id) return;

            // Verify message is not already deleted
            if (msg.deleted === true) return;

            // Verify message is sent
            if (msg.state !== "SENT") return;

            // Prevent default behavior
            event.preventDefault();
            event.stopPropagation();

            // Show notification if enabled
            if (settings.store.showNotification) {
                console.log(`[DoubleClickAntiLog] AntiLog deleting message ${msg.id}`);
            }

            // Perform AntiLog deletion asynchronously
            performAntiLogDeletion(
                msg.id,
                channel.id,
                settings.store.emptyMessage ? "\u17B5" : settings.store.blockMessage,
                settings.store.deleteInterval
            ).catch(error => {
                console.error("[DoubleClickAntiLog] Error during deletion:", error);
            });
        } catch (error) {
            console.error("[DoubleClickAntiLog] Error in onMessageClick:", error);
        }
    }
});
