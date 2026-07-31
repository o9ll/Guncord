/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import { definePluginSettings } from "@api/Settings";
import { showNotification } from "@api/Notifications";
import definePlugin, { OptionType } from "@utils/types";
import { ChannelStore, Constants, Menu, RestAPI, UserStore } from "@webpack/common";
import { Channel } from "discord-types/general";

const settings = definePluginSettings({
    enabled: {
        type: OptionType.BOOLEAN,
        description: "Enable GroupKicker plugin",
        default: true
    },
    showNotifications: {
        type: OptionType.BOOLEAN,
        description: "Show notifications on actions",
        default: true
    },
    confirmBeforeKick: {
        type: OptionType.BOOLEAN,
        description: "Ask for confirmation before kicking all members",
        default: true
    },
    debugMode: {
        type: OptionType.BOOLEAN,
        description: "Debug mode (detailed logs)",
        default: false
    }
});

// Log with prefix
function log(message: string, level: "info" | "warn" | "error" = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[GroupKicker ${timestamp}]`;

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

// Debug log
function debugLog(message: string) {
    if (settings.store.debugMode) {
        log(`🔍 ${message}`, "info");
    }
}

// Confirm the action
function confirmKickAll(memberCount: number): boolean {
    if (!settings.store.confirmBeforeKick) return true;

    return confirm(
        `⚠️ Are you sure you want to kick all ${memberCount} members of this group?\n\n` +
        "This action cannot be undone.\n" +
        "All members will be removed instantly."
    );
}

// Kick a specific user from a group
async function kickUserFromGroup(channelId: string, userId: string): Promise<boolean> {
    try {
        debugLog(`Attempting to kick user ${userId} from group ${channelId}`);

        await RestAPI.del({
            url: `/channels/${channelId}/recipients/${userId}`
        });

        debugLog(`✅ User ${userId} kicked successfully`);
        return true;
    } catch (error) {
        log(`❌ Error kicking user ${userId}: ${error}`, "error");
        return false;
    }
}

// Main function to kick all group members
async function kickAllMembers(channelId: string) {
    if (!settings.store.enabled) {
        log("Plugin disabled", "warn");
        return;
    }

    try {
        const channel = ChannelStore.getChannel(channelId);
        const currentUserId = UserStore.getCurrentUser()?.id;

        if (!channel) {
            log("Channel not found", "error");
            return;
        }

        if (channel.type !== 3) { // 3 = GROUP_DM
            log("This is not a group DM", "error");
            return;
        }

        if (!currentUserId) {
            log("Could not get current user ID", "error");
            return;
        }

        const recipients = channel.recipients || [];
        const channelName = channel.name || "Unnamed group";

        debugLog(`📊 Group info:
- Name: ${channelName}
- ID: ${channelId}
- Owner: ${channel.ownerId}
- Recipients: ${recipients.length}
- Current user: ${currentUserId}`);

        // Check if user is the group owner
        if (channel.ownerId !== currentUserId) {
            log("❌ Only the group owner can use this function", "error");

            if (settings.store.showNotifications) {
                showNotification({
                    title: "❌ GroupKicker",
                    body: "Only the group owner can kick all members",
                    icon: undefined
                });
            }
            return;
        }

        if (recipients.length === 0) {
            log("No members to kick", "warn");

            if (settings.store.showNotifications) {
                showNotification({
                    title: "ℹ️ GroupKicker",
                    body: "No members to kick in this group",
                    icon: undefined
                });
            }
            return;
        }

        // Ask for confirmation
        if (!confirmKickAll(recipients.length)) {
            log("Action cancelled by user");
            return;
        }

        log(`🚀 Starting kick of ${recipients.length} member(s) from "${channelName}"`);

        let successCount = 0;
        let failureCount = 0;

        // Start notification
        if (settings.store.showNotifications) {
            showNotification({
                title: "🔄 GroupKicker in progress",
                body: `Kicking ${recipients.length} member(s)...`,
                icon: undefined
            });
        }

        // Kick each member (except current user)
        for (const recipientId of recipients) {
            if (recipientId === currentUserId) {
                debugLog(`⏭️ Skipping current user: ${recipientId}`);
                continue;
            }

            const success = await kickUserFromGroup(channelId, recipientId);
            if (success) {
                successCount++;
            } else {
                failureCount++;
            }

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        const totalProcessed = successCount + failureCount;

        log(`✅ Operation complete:
- Members processed: ${totalProcessed}
- Success: ${successCount}
- Failures: ${failureCount}`);

        // Final notification
        if (settings.store.showNotifications) {
            const title = failureCount > 0 ? "⚠️ GroupKicker completed with errors" : "✅ GroupKicker completed";
            const body = failureCount > 0
                ? `${successCount} members kicked, ${failureCount} failures`
                : `${successCount} members kicked successfully`;

            showNotification({
                title,
                body,
                icon: undefined
            });
        }

    } catch (error) {
        log(`❌ Global error during kick: ${error}`, "error");

        if (settings.store.showNotifications) {
            showNotification({
                title: "❌ GroupKicker - Error",
                body: "An error occurred during kick",
                icon: undefined
            });
        }
    }
}

// Context menu patch for groups
const GroupContextMenuPatch: NavContextMenuPatchCallback = (children, { channel }: { channel: Channel; }) => {
    if (!channel || channel.type !== 3) return; // 3 = GROUP_DM

    const currentUserId = UserStore.getCurrentUser()?.id;
    const isOwner = channel.ownerId === currentUserId;
    const memberCount = (channel.recipients?.length || 0);

    // Don't show the option if user is not owner or no members
    if (!isOwner || memberCount === 0) return;

    const group = findGroupChildrenByChildId("leave-channel", children);

    if (group) {
        group.push(
            <Menu.MenuSeparator />,
            <Menu.MenuItem
                id="vc-kick-all-members"
                label={`🦶 Kick all members (${memberCount})`}
                color="danger"
                action={() => kickAllMembers(channel.id)}
                icon={() => (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 7V9C15 9.55 14.55 10 14 10S13 9.55 13 9V7H11V9C11 9.55 10.45 10 10 10S9 9.55 9 9V7L3 7V9H5V19C5 20.1 5.9 21 7 21H17C18.1 21 19 20.1 19 19V9H21Z" />
                    </svg>
                )}
            />
        );
    }
};

export default definePlugin({
    name: "GroupKicker",
    description: "Lets group owners kick all members in one click",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    dependencies: ["ContextMenuAPI"],
    settings,

    contextMenus: {
        "gdm-context": GroupContextMenuPatch
    },

    start() {
        log("🚀 GroupKicker plugin started");
        debugLog(`Debug mode: ${settings.store.debugMode ? "ON" : "OFF"}`);
        debugLog(`Notifications: ${settings.store.showNotifications ? "ON" : "OFF"}`);
        debugLog(`Confirmation: ${settings.store.confirmBeforeKick ? "ON" : "OFF"}`);

        if (settings.store.showNotifications) {
            showNotification({
                title: "🦶 GroupKicker enabled",
                body: "Right-click a group to kick all members",
                icon: undefined
            });
        }
    },

    stop() {
        log("🛑 GroupKicker plugin stopped");

        if (settings.store.showNotifications) {
            showNotification({
                title: "🦶 GroupKicker disabled",
                body: "Plugin stopped",
                icon: undefined
            });
        }
    }
});
