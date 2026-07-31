/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType } from "@api/Commands";
import definePlugin from "@utils/types";
import { ChannelStore, Constants, RestAPI, SelectedChannelStore, showToast, Toasts } from "@webpack/common";

let shouldBlockNextMessage = false;

export default definePlugin({
    name: "ScrapMessageUltraSilent",
    description: "Scrape DM → download as TXT only, zero messages sent",
    authors: [{ name: ".zp", id: 1020801845490356245n }],

    patches: [
        {
            find: "trackWithMetadata:function",
            replacement: {
                match: /(sendMessage:\i\(\i,\i,(\i)){/,
                replace: "$1{if($self.shouldBlock($2))return;",
            }
        }
    ],

    shouldBlock(message: any) {
        if (shouldBlockNextMessage && message.content?.startsWith("/scrapmessage")) {
            shouldBlockNextMessage = false;
            return true;
        }
        return false;
    },

    commands: [{
        name: "scrapmessage",
        description: "Export messages as TXT (no visible trace)",
        inputType: ApplicationCommandInputType.BUILT_IN,
        execute: async () => {
            shouldBlockNextMessage = true;

            const channelId = SelectedChannelStore.getChannelId();
            if (!channelId) {
                showToast("❌ No channel selected", Toasts.Type.FAILURE);
                return;
            }

            const channel = ChannelStore.getChannel(channelId);
            if (!channel?.isDM() && !channel?.isGroupDM()) {
                showToast("❌ Only works in DMs and groups", Toasts.Type.FAILURE);
                return;
            }

            showToast("🔄 Loading all messages...", Toasts.Type.MESSAGE);

            // Fetch ALL messages via pagination
            const allMessages: any[] = [];
            let oldestId: string | undefined;
            let batchCount = 0;
            const BATCH_SIZE = 100; // Discord limit

            try {
                while (true) {
                    const res = await RestAPI.get({
                        url: Constants.Endpoints.MESSAGES(channelId),
                        query: {
                            limit: BATCH_SIZE,
                            ...(oldestId ? { before: oldestId } : {})
                        },
                        retries: 3
                    });

                    const batch = res.body || [];
                    if (batch.length === 0) break;

                    allMessages.push(...batch);
                    batchCount++;

                    // Progress update
                    if (batchCount % 5 === 0) {
                        showToast(`🔄 Loaded ${allMessages.length} messages...`, Toasts.Type.MESSAGE);
                    }

                    // If less than BATCH_SIZE messages, we've reached the end
                    if (batch.length < BATCH_SIZE) break;

                    // ID of the oldest message for the next request
                    oldestId = batch[batch.length - 1].id;

                    // Pause to avoid rate limiting
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } catch (error) {
                showToast("❌ Error loading messages", Toasts.Type.FAILURE);
                console.error("Error fetching messages:", error);
                return;
            }

            if (allMessages.length < 1) {
                showToast("❌ No messages found", Toasts.Type.FAILURE);
                return;
            }

            // Sort chronologically (oldest first)
            allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

            let content = "=== PRIVATE CONVERSATION ===\n";
            content += `Channel ID: ${channelId}\n`;
            content += `Export: ${new Date().toLocaleString()}\n`;
            content += `Total messages: ${allMessages.length}\n\n`;

            for (const m of allMessages) {
                if (!m.content?.trim() && !m.attachments?.length && !m.embeds?.length) continue;

                const time = new Date(m.timestamp).toLocaleString();
                const author = m.author?.global_name || m.author?.username || "?";
                const text = m.content?.trim() || "[media or embed]";

                content += `[${time}] ${author}: ${text}\n`;
            }

            const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const timestamp = Date.now();
            const filename = `dm-${channelId}-${timestamp}.txt`;
            const a = document.createElement("a");
            a.href = url;
            a.download = filename;
            a.style.display = "none";
            document.body.appendChild(a);
            a.click();

            // Cleanup
            requestAnimationFrame(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            });

            showToast(`✅ ${allMessages.length} messages exported (${batchCount} requests)`, Toasts.Type.SUCCESS);
        }
    }]
});
