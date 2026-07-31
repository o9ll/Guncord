/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 Guncord contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { DataStore } from "@api/index";
import { findGroupChildrenByChildId, NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import { Constants, GuildStore, Menu, React, RestAPI, showToast, Toasts } from "@webpack/common";
import { t } from "../autoTranslateGuncord";

// Key format: `${guildId}:${userId}`
const autoMutedUsers = new Set<string>();

async function loadAutoMuted() {
    try {
        const saved = await DataStore.get<string[]>("AutoMute_users");
        if (Array.isArray(saved)) {
            autoMutedUsers.clear();
            saved.forEach(k => autoMutedUsers.add(k));
        }
    } catch { }
}

async function saveAutoMuted() {
    try {
        await DataStore.set("AutoMute_users", Array.from(autoMutedUsers));
    } catch { }
}

async function setServerMute(guildId: string, userId: string, mute: boolean): Promise<boolean> {
    try {
        await RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: { mute }
        });
        return true;
    } catch (e: any) {
        console.error("[AutoMute] Server mute failed:", e);
        return false;
    }
}

interface VoiceState {
    userId: string;
    guildId?: string;
    channelId?: string;
    mute: boolean;
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, ctx: { user?: any; guildId?: string; channel?: any; } = {}) => {
    const { user, channel } = ctx;
    if (!user || !Array.isArray(children)) return;

    const guildId = ctx.guildId ?? channel?.guild_id ?? GuildStore.getGuildId();
    if (!guildId) return;

    const key = `${guildId}:${user.id}`;
    const isAutoMuted = autoMutedUsers.has(key);

    const menuItem = (
        <Menu.MenuCheckboxItem
            key="auto-mute-toggle"
            id="vc-auto-mute-toggle"
            label={t("Auto Mute")}
            color="danger"
            checked={isAutoMuted}
            action={async () => {
                const next = !isAutoMuted;
                if (next) {
                    autoMutedUsers.add(key);
                    await saveAutoMuted();
                    showToast(t("Auto Mute enabled for ") + (user.username || user.tag || "user"), Toasts.Type.SUCCESS);
                    const ok = await setServerMute(guildId, user.id, true);
                    if (!ok) {
                        showToast(t("Failed to server mute (check permissions)"), Toasts.Type.FAILURE);
                    }
                } else {
                    autoMutedUsers.delete(key);
                    await saveAutoMuted();
                    showToast(t("Auto Mute disabled for ") + (user.username || user.tag || "user"), Toasts.Type.INFO);
                    await setServerMute(guildId, user.id, false);
                }
            }}
        />
    );

    // Search specifically for the Server Moderation group (scanning bottom to top)
    let targetGroup: any[] | null = null;
    let targetIndex = -1;

    for (let g = children.length - 1; g >= 0; g--) {
        const groupCandidate = children[g];
        const groupItems = Array.isArray(groupCandidate)
            ? groupCandidate
            : Array.isArray(groupCandidate?.props?.children)
                ? groupCandidate.props.children
                : null;

        if (!Array.isArray(groupItems)) continue;

        // Skip volume slider group
        const isVolumeGroup = groupItems.some((c: any) => {
            const id = String(c?.props?.id || "");
            return id.includes("volume") || c?.props?.type === "slider";
        });
        if (isVolumeGroup) continue;

        // Skip top profile/friends group
        const isProfileGroup = groupItems.some((c: any) => {
            const id = String(c?.props?.id || "");
            return id === "user-profile" || id === "mention" || id === "add-friend";
        });
        if (isProfileGroup) continue;

        // Priority 1: Match server deafen or server mute by ID or label
        for (let i = 0; i < groupItems.length; i++) {
            const item = groupItems[i];
            const id = String(item?.props?.id || "");
            const label = String(item?.props?.label || "");

            if (
                id.includes("server-deafen") || id.includes("guild-deafen") ||
                label.includes("Mettre en sourdine sur le serveur") || label.includes("Server Deafen") ||
                id.includes("server-mute") || id.includes("guild-mute") ||
                label.includes("Rendre muet sur le serveur") || label.includes("Server Mute")
            ) {
                targetGroup = groupItems;
                targetIndex = i + 1;
                break;
            }
        }
        if (targetGroup) break;

        // Priority 2: Match mod-view or disconnect
        for (let i = 0; i < groupItems.length; i++) {
            const item = groupItems[i];
            const id = String(item?.props?.id || "");
            const label = String(item?.props?.label || "");

            if (id.includes("mod-view") || label.includes("modérateur") || label.includes("Mod View")) {
                targetGroup = groupItems;
                targetIndex = i + 1;
                break;
            }
            if (id.includes("disconnect") || label.includes("Déconnecter")) {
                targetGroup = groupItems;
                targetIndex = i;
                break;
            }
        }
        if (targetGroup) break;
    }

    if (!targetGroup) {
        // Fallback to last group (usually moderation/voice group) instead of top profile group
        for (let g = children.length - 1; g >= 0; g--) {
            const groupCandidate = children[g];
            const groupItems = Array.isArray(groupCandidate)
                ? groupCandidate
                : Array.isArray(groupCandidate?.props?.children)
                    ? groupCandidate.props.children
                    : null;

            if (Array.isArray(groupItems)) {
                targetGroup = groupItems;
                targetIndex = groupItems.length;
                break;
            }
        }
    }

    if (targetGroup && targetIndex >= 0) {
        targetGroup.splice(targetIndex, 0, menuItem);
    }
};

export default definePlugin({
    name: "AutoMute",
    description: "Automatically server mutes selected users and re-mutes them instantly if they unmute.",
    authors: [
        { name: "Guncord", id: 0n }
    ],
    enabledByDefault: true,

    contextMenus: {
        "user-context": UserContextMenuPatch
    },

    flux: {
        VOICE_STATE_UPDATES({ voiceStates }: { voiceStates: VoiceState[]; }) {
            if (!Array.isArray(voiceStates)) return;

            for (const state of voiceStates) {
                const { userId, guildId, mute } = state;
                if (!userId || !guildId) continue;

                const key = `${guildId}:${userId}`;
                if (autoMutedUsers.has(key)) {
                    // If user is currently NOT server-muted, mute them back instantly!
                    if (!mute) {
                        setServerMute(guildId, userId, true).catch(() => {});
                    }
                }
            }
        }
    },

    start() {
        loadAutoMuted();
    },

    stop() {
        autoMutedUsers.clear();
    }
});
