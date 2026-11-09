/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { NavContextMenuPatchCallback } from "@api/ContextMenu";
import definePlugin from "@utils/types";
import { ChannelStore, FluxDispatcher, Menu, MessageStore, React, SelectedChannelStore, showToast, Toasts } from "@webpack/common";
import { t } from "../autoTranslateGuncord";

// ─── Minimalist SVG Icon (Strict Zero-Emoji Policy) ───────────────────────────
function FakeDeleteIcon(props: any) {
    return (
        <svg aria-hidden="true" role="img" width={props.width || 18} height={props.height || 18} fill="none" viewBox="0 0 24 24" {...props}>
            <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="m10 11 4 4m0-4-4 4" />
        </svg>
    );
}

// ─── Session State (In-Memory Only, Restores on Discord Restart) ───────────────
interface DeletedRecord {
    message: any;
    channelId: string;
}

const locallyDeletedMessages = new Map<string, DeletedRecord>(); // messageId -> { message, channelId }
const locallyDeletedIds = new Set<string>();
const deletedMessageChannelMap = new Map<string, string>(); // messageId -> channelId

let oldGetMessage: typeof MessageStore.getMessage | null = null;
let oldGetMessages: typeof MessageStore.getMessages | null = null;
let oldGetLastMessage: typeof MessageStore.getLastMessage | null = null;

const STYLE_ID = "nc-fake-delete-style";

function updateFakeDeleteStyle() {
    let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (locallyDeletedIds.size === 0) {
        if (style) style.textContent = "";
        return;
    }
    if (!style) {
        style = document.createElement("style");
        style.id = STYLE_ID;
        document.head.appendChild(style);
    }
    const rules: string[] = [];
    for (const id of locallyDeletedIds) {
        rules.push(`[id*="${id}"], [data-list-item-id*="${id}"] { display: none !important; }`);
    }
    style.textContent = rules.join("\n");
}

const FLUX_MESSAGE_EVENTS = [
    "LOAD_MESSAGES_SUCCESS",
    "LOCAL_MESSAGES_LOADED",
    "LOAD_MESSAGES_AROUND_SUCCESS",
    "PRELOAD_MESSAGES_SUCCESS",
    "LOAD_PINNED_MESSAGES_SUCCESS",
    "SEARCH_FINISH"
];

function cleanCollection(collection: any) {
    if (!collection || locallyDeletedIds.size === 0) return;
    try {
        if (Array.isArray(collection._array)) {
            let found = false;
            for (let i = 0; i < collection._array.length; i++) {
                if (locallyDeletedIds.has(collection._array[i]?.id)) {
                    found = true;
                    break;
                }
            }
            if (found) {
                collection._array = collection._array.filter((m: any) => !locallyDeletedIds.has(m?.id));
                if (collection._map) {
                    for (const id of locallyDeletedIds) {
                        delete collection._map[id];
                        if (typeof collection._map.delete === "function") {
                            collection._map.delete(id);
                        }
                    }
                }
                if (Array.isArray(collection._orderedKeys)) {
                    collection._orderedKeys = collection._orderedKeys.filter((id: string) => !locallyDeletedIds.has(id));
                }
            }
        }
    } catch {}
}

export function fakeDeleteMessage(message: { id: string; channel_id?: string; channelId?: string }) {
    const chId = message.channel_id || message.channelId || SelectedChannelStore.getChannelId();
    if (!message?.id || !chId) return;

    // 1. Capture rich message object before removal from stores
    const storedMessage = MessageStore?.getMessage?.(chId, message.id);
    const fullMessage = storedMessage || message;

    locallyDeletedMessages.set(message.id, { message: fullMessage, channelId: chId });
    locallyDeletedIds.add(message.id);
    deletedMessageChannelMap.set(message.id, chId);

    // 2. Instant CSS hide (0ms latency, element disappears instantly)
    updateFakeDeleteStyle();

    // 3. Immediately sanitize MessageStore collection in-place
    if (MessageStore?.getMessages) {
        cleanCollection(MessageStore.getMessages(chId));
    }

    // 4. Dispatch MESSAGE_DELETE with mlDeleted: true (ensures MessageLogger doesn't re-insert it)
    FluxDispatcher.dispatch({
        type: "MESSAGE_DELETE",
        id: message.id,
        channelId: chId,
        mlDeleted: true,
        fakeDelete: true
    });

    try {
        (MessageStore as any)?.emitChange?.();
    } catch {}

    showToast(t("Message hidden locally until restart."), Toasts.Type.SUCCESS);
}

export function restoreAllLocallyDeletedMessages() {
    const count = locallyDeletedIds.size;
    if (count === 0) return;

    const affectedChannels = new Set<string>();

    for (const [msgId, record] of locallyDeletedMessages.entries()) {
        const { message, channelId } = record;
        affectedChannels.add(channelId);

        // 1. Re-inject into MessageStore collection
        try {
            const collection = MessageStore?.getMessages?.(channelId) as any;
            if (collection && message) {
                if (typeof collection.receiveMessage === "function") {
                    collection.receiveMessage(message);
                } else if (Array.isArray(collection._array)) {
                    if (!collection._array.some((m: any) => m?.id === msgId)) {
                        collection._array.push(message);
                        collection._array.sort((a: any, b: any) => {
                            try { return BigInt(a.id) > BigInt(b.id) ? 1 : -1; } catch { return 0; }
                        });
                    }
                    if (collection._map) {
                        collection._map[msgId] = message;
                        if (typeof collection._map.set === "function") collection._map.set(msgId, message);
                    }
                }
            }
        } catch {}

        // 2. Dispatch MESSAGE_CREATE to notify Discord Flux stores and trigger immediate render
        try {
            FluxDispatcher.dispatch({
                type: "MESSAGE_CREATE",
                channelId,
                message,
                optimistic: false,
                isPushNotification: false
            });
        } catch {}
    }

    // 3. Clear deleted IDs and instant style
    locallyDeletedIds.clear();
    locallyDeletedMessages.clear();
    deletedMessageChannelMap.clear();
    updateFakeDeleteStyle();

    // 4. Emit change on MessageStore so all React components re-render immediately
    try {
        (MessageStore as any)?.emitChange?.();
    } catch {}

    showToast(`${count} ${t("messages restored.")}`, Toasts.Type.SUCCESS);
}

// ─── Filter re-fetched messages in active session across all loaders ──────────
function filterMessagesInEvent(event: any) {
    if (!event || locallyDeletedIds.size === 0) return;
    if (Array.isArray(event.messages)) {
        event.messages = event.messages.map((item: any) => {
            if (Array.isArray(item)) {
                return item.filter((m: any) => !locallyDeletedIds.has(m?.id));
            }
            return locallyDeletedIds.has(item?.id) ? null : item;
        }).filter(Boolean);
    }
}

// ─── Re-assert Deletions on Channel Select (Even if DM was closed & reopened) ──
function onChannelSelect(event: any) {
    const chId = event?.channelId;
    if (!chId || locallyDeletedIds.size === 0) return;

    updateFakeDeleteStyle();

    setTimeout(() => {
        try {
            if (MessageStore?.getMessages) {
                const col = MessageStore.getMessages(chId);
                cleanCollection(col);
            }
            for (const [msgId, msgChannelId] of deletedMessageChannelMap.entries()) {
                if (msgChannelId === chId) {
                    FluxDispatcher.dispatch({
                        type: "MESSAGE_DELETE",
                        id: msgId,
                        channelId: chId,
                        mlDeleted: true,
                        fakeDelete: true
                    });
                }
            }
            (MessageStore as any)?.emitChange?.();
        } catch {}
    }, 0);
}

// ─── Context Menu Patch ───────────────────────────────────────────────────────
const MessageContextMenuPatch: NavContextMenuPatchCallback = (children, { message }) => {
    if (!message?.id) return;

    const menuItem = (
        <Menu.MenuGroup key="nc-fake-delete-group">
            <Menu.MenuItem
                id="nc-fake-delete-message"
                label={t("Fake Delete (Local Only)")}
                color="danger"
                icon={FakeDeleteIcon}
                iconLeft={FakeDeleteIcon}
                leadingAccessory={{
                    type: "icon",
                    icon: FakeDeleteIcon
                }}
                action={() => fakeDeleteMessage(message)}
            />
        </Menu.MenuGroup>
    );

    children.push(menuItem);
};

export default definePlugin({
    name: "FakeDeleteMessage",
    description: "Locally deletes messages from view during the current session. Messages are restored upon restarting Discord.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    enabledByDefault: false,
    dependencies: ["ContextMenuAPI", "MessagePopoverAPI"],

    contextMenus: {
        "message": MessageContextMenuPatch,
        "message-actions": MessageContextMenuPatch,
        "textarea-context": MessageContextMenuPatch
    },

    messagePopoverButton: {
        icon: FakeDeleteIcon,
        render(message: any) {
            if (!message?.id) return null;
            return {
                label: t("Fake Delete (Local Only)"),
                icon: FakeDeleteIcon,
                message,
                channel: ChannelStore.getChannel(message.channel_id),
                onClick: () => fakeDeleteMessage(message)
            };
        }
    },

    start() {
        for (const ev of FLUX_MESSAGE_EVENTS) {
            FluxDispatcher.subscribe(ev, filterMessagesInEvent);
        }
        FluxDispatcher.subscribe("CHANNEL_SELECT", onChannelSelect);

        if (MessageStore) {
            oldGetMessage = MessageStore.getMessage;
            MessageStore.getMessage = function (channelId: string, messageId: string) {
                if (locallyDeletedIds.has(messageId)) return undefined as any;
                return oldGetMessage?.apply(this, arguments as any);
            };

            oldGetMessages = MessageStore.getMessages;
            MessageStore.getMessages = function (channelId: string) {
                const col = oldGetMessages?.apply(this, arguments as any);
                if (col && locallyDeletedIds.size > 0) {
                    cleanCollection(col);
                }
                return col;
            };

            oldGetLastMessage = MessageStore.getLastMessage;
            MessageStore.getLastMessage = function (channelId: string) {
                const msg = oldGetLastMessage?.apply(this, arguments as any);
                if (msg && locallyDeletedIds.has(msg.id)) {
                    const msgs = MessageStore.getMessages(channelId);
                    const arr = (msgs as any)?.toArray?.() ?? (msgs as any)?._array ?? [];
                    return arr.length > 0 ? arr[arr.length - 1] : undefined;
                }
                return msg;
            };
        }

        updateFakeDeleteStyle();
    },

    stop() {
        for (const ev of FLUX_MESSAGE_EVENTS) {
            FluxDispatcher.unsubscribe(ev, filterMessagesInEvent);
        }
        FluxDispatcher.unsubscribe("CHANNEL_SELECT", onChannelSelect);

        if (MessageStore) {
            if (oldGetMessage) MessageStore.getMessage = oldGetMessage;
            if (oldGetMessages) MessageStore.getMessages = oldGetMessages;
            if (oldGetLastMessage) MessageStore.getLastMessage = oldGetLastMessage;
        }

        document.getElementById(STYLE_ID)?.remove();
        locallyDeletedIds.clear();
        locallyDeletedMessages.clear();
        deletedMessageChannelMap.clear();
    }
});

