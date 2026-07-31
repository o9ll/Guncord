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
const autoDecoedUsers = new Set<string>();

async function loadAutoDecoed() {
    try {
        const saved = await DataStore.get<string[]>("AutoDeco_users");
        if (Array.isArray(saved)) {
            autoDecoedUsers.clear();
            saved.forEach(k => autoDecoedUsers.add(k));
        }
    } catch { }
}

async function saveAutoDecoed() {
    try {
        await DataStore.set("AutoDeco_users", Array.from(autoDecoedUsers));
    } catch { }
}

async function setServerDisconnect(guildId: string, userId: string): Promise<boolean> {
    try {
        await RestAPI.patch({
            url: Constants.Endpoints.GUILD_MEMBER(guildId, userId),
            body: { channel_id: null }
        });
        return true;
    } catch (e: any) {
        console.error("[AutoDeco] Server disconnect failed:", e);
        return false;
    }
}

interface VoiceState {
    userId: string;
    guildId?: string;
    channelId?: string | null;
}

const UserContextMenuPatch: NavContextMenuPatchCallback = (children, ctx: { user?: any; guildId?: string; channel?: any; } = {}) => {
    const { user, channel } = ctx;
    if (!user || !Array.isArray(children)) return;

    const guildId = ctx.guildId ?? channel?.guild_id ?? GuildStore.getGuildId();
    if (!guildId) return;

    const key = `${guildId}:${user.id}`;
    const isAutoDecoed = autoDecoedUsers.has(key);

    const menuItem = (
        <Menu.MenuCheckboxItem
            key="auto-deco-toggle"
            id="vc-auto-deco-toggle"
            label={t("Auto Deco")}
            color="danger"
            checked={isAutoDecoed}
            action={async () => {
                const next = !isAutoDecoed;
                if (next) {
                    autoDecoedUsers.add(key);
                    await saveAutoDecoed();
                    showToast(t("Auto Deco enabled for ") + (user.username || user.tag || "user"), Toasts.Type.SUCCESS);
                    const ok = await setServerDisconnect(guildId, user.id);
                    if (!ok) {
                        showToast(t("Failed to disconnect user (check permissions)"), Toasts.Type.FAILURE);
                    }
                } else {
                    autoDecoedUsers.delete(key);
                    await saveAutoDecoed();
                    showToast(t("Auto Deco disabled for ") + (user.username || user.tag || "user"), Toasts.Type.INFO);
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

        // Priority 1: Right below AutoMute toggle if present
        const autoMuteIdx = groupItems.findIndex((c: any) => c?.props?.id === "vc-auto-mute-toggle");
        if (autoMuteIdx >= 0) {
            targetGroup = groupItems;
            targetIndex = autoMuteIdx + 1;
            break;
        }

        // Priority 2: Match server deafen or server mute by ID or label
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

        // Priority 3: Match mod-view or disconnect
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
    name: "AutoDeco",
    description: "Automatically disconnects selected users whenever they join a voice channel.",
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
                const { userId, guildId, channelId } = state;
                if (!userId || !guildId) continue;

                const key = `${guildId}:${userId}`;
                if (autoDecoedUsers.has(key)) {
                    // If user is currently in a voice channel, disconnect them instantly!
                    if (channelId) {
                        setServerDisconnect(guildId, userId).catch(() => {});
                    }
                }
            }
        }
    },

    start() {
        loadAutoDecoed();
    },

    stop() {
        autoDecoedUsers.clear();
    }
});
