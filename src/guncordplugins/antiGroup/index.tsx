/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import definePlugin, { OptionType } from "@utils/types";
import { Constants, ChannelStore, RestAPI, UserStore } from "@webpack/common";

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable AntiGroup plugin",
        default: true
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        description: "Show notifications on auto leave",
        default: true
    },
    verboseLogs: {
        type: OptionType.BOOLEAN,
        description: "Show detailed logs in console",
        default: true
    },
    delay: {
        type: OptionType.NUMBER,
        description: "Delay before leaving group (ms)",
        default: 1000,
        min: 100,
        max: 10000
    },
    whitelist: {
        type: OptionType.STRING,
        description: "User IDs allowed to add you (comma-separated)",
        default: ""
    },
    autoReply: {
        type: OptionType.BOOLEAN,
        description: "Send auto message before leaving",
        default: true
    },
    replyMessage: {
        type: OptionType.STRING,
        description: "Message to send before leaving",
        default: "I don't want to be added to groups. Please DM me."
    }
});

// Log with prefix
function log(message: string, level: "info" | "warn" | "error" = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[AntiGroup ${timestamp}]`;

    switch (level) {
        case "warn":
            console.warn(prefix, message);
            break;
        case "error":
            console.error(prefix, message);
            break;
        default:
            console.log(prefix, message);
    }
}

// Verbose log (only if enabled)
function verboseLog(message: string) {
    if (settings.store.verboseLogs) {
        log(message);
    }
}

// Leave a group DM
async function leaveGroupDM(channelId: string) {
    try {
        const channel = ChannelStore.getChannel(channelId);
        const channelName = channel?.name || "Unnamed group";
        const recipients = channel?.recipients || [];

        log(`🚀 Starting leave procedure for "${channelName}" (ID: ${channelId})`);
        verboseLog(`📊 Group info:
- Name: ${channelName}
- ID: ${channelId}
- Type: ${channel?.type}
- Owner: ${channel?.ownerId}
- Members: ${recipients.length + 1}`);

        // Send auto message if enabled
        if (settings.store.autoReply && settings.store.replyMessage.trim()) {
            log(`💬 Sending auto message: "${settings.store.replyMessage}"`);

            try {
                await RestAPI.post({
                    url: Constants.Endpoints.MESSAGES(channelId),
                    body: {
                        content: settings.store.replyMessage
                    }
                });

                log(`✅ Auto message sent successfully`);
                verboseLog(`⏱️ Waiting 500ms for message delivery...`);

                // Wait a bit before leaving so the message is sent
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (msgError) {
                log(`❌ Error sending auto message: ${msgError}`, "error");
            }
        } else {
            verboseLog(`🔇 Auto message disabled or empty`);
        }

        // Leave the group
        log(`🚪 Attempting to leave group...`);
        await RestAPI.del({
            url: Constants.Endpoints.CHANNEL(channelId)
        });

        log(`✅ Successfully left group: "${channelName}"`);

        // Success notification
        if (settings.store.showNotifications) {
            showNotification({
                title: "🛡️ AntiGroup - Left group",
                body: `You've automatically left the group "${channelName}"`,
                icon: undefined
            });
            verboseLog(`🔔 Success notification shown`);
        }

        // Final log with stats
        log(`📈 Leave stats:
- Group: "${channelName}" (${channelId})
- Auto message sent: ${settings.store.autoReply ? "Yes" : "No"}
- Delay applied: ${settings.store.delay}ms
- Notification shown: ${settings.store.showNotifications ? "Yes" : "No"}`);

    } catch (error) {
        const channel = ChannelStore.getChannel(channelId);
        const channelName = channel?.name || "Unknown group";

        log(`❌ ERROR leaving group "${channelName}" (${channelId}): ${error}`, "error");

        // Detailed error log
        if (settings.store.verboseLogs) {
            console.error("[AntiGroup] Error details:", {
                channelId,
                channelName,
                error,
                stack: error instanceof Error ? error.stack : undefined
            });
        }

        // Error notification
        if (settings.store.showNotifications) {
            showNotification({
                title: "❌ AntiGroup - Error",
                body: `Could not auto-leave the group "${channelName}"`,
                icon: undefined
            });
            verboseLog(`🔔 Error notification shown`);
        }
    }
}

// Check if a user is whitelisted
function isUserWhitelisted(userId: string): boolean {
    const whitelist = settings.store.whitelist
        .split(",")
        .map(id => id.trim())
        .filter(id => id.length > 0);

    const isWhitelisted = whitelist.includes(userId);
    verboseLog(`🔍 Whitelist check for user ${userId}: ${isWhitelisted ? "ALLOWED" : "NOT ALLOWED"}`);

    return isWhitelisted;
}

// Check if current user was recently added to the group
function wasRecentlyAdded(channel: any, currentUserId: string): boolean {
    // Check if it's a group DM (type 3)
    if (channel.type !== 3) {
        verboseLog(`❌ Channel ${channel.id} is not a group DM (type: ${channel.type})`);
        return false;
    }

    // If the channel was just created and the user is not the owner
    const wasAdded = channel.ownerId !== currentUserId;
    verboseLog(`🔍 Recent add check: ${wasAdded ? "ADDED BY SOMEONE ELSE" : "CREATED BY YOU"} (Owner: ${channel.ownerId})`);

    return wasAdded;
}

export default definePlugin({
    name: "AntiGroup",
    description: "Automatically leave group DMs when added",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    settings,

    flux: {
        // Triggered when a new channel is created (including group DMs)
        CHANNEL_CREATE(event: { channel: any; }) {
            verboseLog(`📺 CHANNEL_CREATE event detected for channel ${event.channel?.id}`);

            if (!settings.store.enabled) {
                verboseLog(`🔒 Plugin disabled, skipping`);
                return;
            }

            const { channel } = event;
            const currentUserId = UserStore.getCurrentUser()?.id;

            if (!channel || !currentUserId) {
                verboseLog(`❌ Missing data: channel=${!!channel}, currentUserId=${!!currentUserId}`);
                return;
            }

            verboseLog(`📋 Channel analysis:
- ID: ${channel.id}
- Type: ${channel.type}
- Name: ${channel.name || "Unnamed"}
- Owner: ${channel.ownerId}
- Current user: ${currentUserId}`);

            // Check if it's a group DM (type 3)
            if (channel.type !== 3) {
                verboseLog(`⏭️ Skipped: not a group DM (type ${channel.type})`);
                return;
            }

            // Check if user was recently added
            if (!wasRecentlyAdded(channel, currentUserId)) {
                verboseLog(`⏭️ Skipped: you created this group`);
                return;
            }

            log(`🎯 NEW GROUP DM DETECTED: "${channel.name || 'Unnamed'}" (${channel.id})`);

            // Check if the group owner is whitelisted
            if (channel.ownerId && isUserWhitelisted(channel.ownerId)) {
                log(`✅ Owner ${channel.ownerId} is whitelisted, group allowed`);
                return;
            }

            // Check if other group members are whitelisted
            const whitelistedMember = channel.recipients?.find((recipient: any) =>
                isUserWhitelisted(recipient.id)
            );

            if (whitelistedMember) {
                log(`✅ Member ${whitelistedMember.id} is whitelisted, group allowed`);
                return;
            }

            log(`⚠️ NO WHITELISTED MEMBER FOUND - Scheduling auto leave in ${settings.store.delay}ms`);

            // Immediate detection notification
            if (settings.store.showNotifications) {
                showNotification({
                    title: "🚨 AntiGroup - Group detected",
                    body: `Added to group "${channel.name || 'Unnamed'}" - Auto leave in ${settings.store.delay / 1000}s`,
                    icon: undefined
                });
            }

            // Wait the configured delay before leaving
            setTimeout(() => {
                verboseLog(`⏰ Delay elapsed, executing auto leave`);
                leaveGroupDM(channel.id);
            }, settings.store.delay);
        }
    },

    start() {
        log(`🚀 AntiGroup plugin started`);
        log(`⚙️ Current config:
- Notifications: ${settings.store.showNotifications ? "ON" : "OFF"}
- Verbose logs: ${settings.store.verboseLogs ? "ON" : "OFF"}
- Auto message: ${settings.store.autoReply ? "ON" : "OFF"}
- Delay: ${settings.store.delay}ms
- Whitelist: ${settings.store.whitelist || "Empty"}`);

        if (settings.store.showNotifications) {
            showNotification({
                title: "🛡️ AntiGroup enabled",
                body: "Protection against unwanted group DMs enabled",
                icon: undefined
            });
        }
    },

    stop() {
        log(`🛑 AntiGroup plugin stopped`);

        if (settings.store.showNotifications) {
            showNotification({
                title: "🛡️ AntiGroup disabled",
                body: "Protection against group DMs disabled",
                icon: undefined
            });
        }
    }
});
