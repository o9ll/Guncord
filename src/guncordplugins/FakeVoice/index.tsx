/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ApplicationCommandInputType, sendBotMessage } from "@api/Commands";
import { UserAreaButton, UserAreaRenderProps } from "@api/UserArea";
import { find, findStore } from "@webpack";
import definePlugin from "@utils/types";
import {
    ChannelStore,
    ContextMenuApi,
    FluxDispatcher,
    GatewayConnectionStore,
    MediaEngineStore,
    Menu,
    React,
    SelectedChannelStore
} from "@webpack/common";
import { t } from "../autoTranslateGuncord";

let isGhostActive = false;
let configFakeMute = true;
let configFakeDeafen = true;

let originalProtoVSU: any = null;
let originalProtoSend: any = null;
let hookedProto: any = null;

function getGatewaySocket() {
    try {
        if (GatewayConnectionStore?.getSocket) {
            const s = GatewayConnectionStore.getSocket();
            if (s) return s;
        }
    } catch {}

    try {
        const store = findStore("GatewayConnectionStore")
            ?? find((m: any) => typeof m?.getSocket === "function" && typeof m?.isTryingToConnect === "function")
            ?? find((m: any) => typeof m?.default?.getSocket === "function");
        const socket = store?.getSocket?.() ?? store?.default?.getSocket?.();
        if (socket) return socket;
    } catch {}

    try {
        const direct = find((m: any) => typeof m?.voiceStateUpdate === "function" && typeof m?.presenceUpdate === "function");
        if (direct) return direct;
    } catch {}

    return null;
}

function hookSocket(socket: any) {
    if (!socket) return socket;

    try {
        const proto = Object.getPrototypeOf(socket);
        if (proto && !hookedProto) {
            hookedProto = proto;

            if (typeof proto.voiceStateUpdate === "function") {
                originalProtoVSU = proto.voiceStateUpdate;
                proto.voiceStateUpdate = function (args: any, ...rest: any[]) {
                    if (isGhostActive && args) {
                        if (configFakeDeafen) {
                            args.selfDeaf = true;
                            args.selfMute = true;
                        } else if (configFakeMute) {
                            args.selfMute = true;
                        }
                    }
                    return originalProtoVSU.call(this, args, ...rest);
                };
            }

            if (typeof proto.send === "function") {
                originalProtoSend = proto.send;
                proto.send = function (op: number, data: any, ...rest: any[]) {
                    if (op === 4 && isGhostActive && data) {
                        if (configFakeDeafen) {
                            data.self_deaf = true;
                            data.self_mute = true;
                        } else if (configFakeMute) {
                            data.self_mute = true;
                        }
                    }
                    return originalProtoSend.call(this, op, data, ...rest);
                };
            }
        }

        if (typeof socket.voiceStateUpdate === "function" && socket.voiceStateUpdate !== proto?.voiceStateUpdate && !socket.__fakeVoiceHooked) {
            socket.__fakeVoiceHooked = true;
            const origInstVSU = socket.voiceStateUpdate;
            socket.voiceStateUpdate = function (args: any, ...rest: any[]) {
                if (isGhostActive && args) {
                    if (configFakeDeafen) {
                        args.selfDeaf = true;
                        args.selfMute = true;
                    } else if (configFakeMute) {
                        args.selfMute = true;
                    }
                }
                return origInstVSU.call(this, args, ...rest);
            };
        }

        if (typeof socket.send === "function" && socket.send !== proto?.send && !socket.__fakeVoiceSendHooked) {
            socket.__fakeVoiceSendHooked = true;
            const origInstSend = socket.send;
            socket.send = function (op: number, data: any, ...rest: any[]) {
                if (op === 4 && isGhostActive && data) {
                    if (configFakeDeafen) {
                        data.self_deaf = true;
                        data.self_mute = true;
                    } else if (configFakeMute) {
                        data.self_mute = true;
                    }
                }
                return origInstSend.call(this, op, data, ...rest);
            };
        }
    } catch (e) {
        console.error("[FakeVoice] hookSocket error:", e);
    }

    return socket;
}

function unhookSocket() {
    try {
        if (hookedProto) {
            if (originalProtoVSU) {
                hookedProto.voiceStateUpdate = originalProtoVSU;
                originalProtoVSU = null;
            }
            if (originalProtoSend) {
                hookedProto.send = originalProtoSend;
                originalProtoSend = null;
            }
            hookedProto = null;
        }
    } catch (e) {
        console.error("[FakeVoice] unhookSocket error:", e);
    }
}

/**
 * Instantly override the Gateway voice state with our target state.
 */
function syncState() {
    try {
        const channelId = SelectedChannelStore?.getVoiceChannelId?.();
        if (!channelId) return;

        const socket = getGatewaySocket();
        if (!socket) return;
        hookSocket(socket);

        const channel = ChannelStore?.getChannel?.(channelId);
        const guildId = channel?.guild_id ?? null;

        const fakeMute = isGhostActive ? (configFakeMute || configFakeDeafen) : (MediaEngineStore?.isSelfMute?.() ?? false);
        const fakeDeaf = isGhostActive ? configFakeDeafen : (MediaEngineStore?.isSelfDeaf?.() ?? false);

        if (typeof socket.voiceStateUpdate === "function") {
            socket.voiceStateUpdate({
                guildId,
                channelId,
                selfMute: fakeMute,
                selfDeaf: fakeDeaf,
                selfVideo: false,
                preferredRegion: null
            });
        } else if (typeof socket.send === "function") {
            socket.send(4, {
                guild_id: guildId,
                channel_id: channelId,
                self_mute: fakeMute,
                self_deaf: fakeDeaf,
                self_video: false
            });
        }
    } catch (e) {
        console.error("[FakeVoice] syncState error:", e);
    }
}

function onVoiceChange() {
    hookSocket(getGatewaySocket());
    if (isGhostActive) {
        setTimeout(syncState, 50);
        setTimeout(syncState, 250);
    }
}

function FakeDeafenIcon({ className }: { className?: string }) {
    return (
        <svg className={className} width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C7.58 2 4 5.58 4 10V19C4 20.66 5.34 22 7 22C8.66 22 10 20.66 10 19C10 20.66 11.34 22 13 22C14.66 22 16 20.66 16 19C16 20.66 17.34 22 19 22C20.66 22 22 20.66 22 19V10C22 5.58 18.42 2 14 2H10H12Z" fill="currentColor" />
            <circle cx="8.5" cy="10" r="1.5" fill={isGhostActive ? "#121212" : "black"} fillOpacity="0.6" />
            <circle cx="15.5" cy="10" r="1.5" fill={isGhostActive ? "#121212" : "black"} fillOpacity="0.6" />
            {isGhostActive && (
                <path d="M2 2L22 22" stroke="#ed4245" strokeWidth="2.5" strokeLinecap="round" />
            )}
        </svg>
    );
}

function GhostContextMenu() {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    return (
        <Menu.Menu navId="fake-voice-menu" aria-label="Fake Voice Configuration" onClose={ContextMenuApi.closeContextMenu}>
            <Menu.MenuGroup label={t("Ghost Options")}>
                <Menu.MenuCheckboxItem
                    id="opt-both"
                    label={t("Fake Mute & Deafen")}
                    checked={configFakeMute && configFakeDeafen}
                    action={() => {
                        const nextState = !(configFakeMute && configFakeDeafen);
                        configFakeMute = nextState;
                        configFakeDeafen = nextState;
                        forceUpdate();
                        if (isGhostActive) syncState();
                    }}
                />
                <Menu.MenuSeparator />
                <Menu.MenuCheckboxItem
                    id="opt-mute"
                    label={t("Fake Mute")}
                    checked={configFakeMute}
                    action={() => {
                        configFakeMute = !configFakeMute;
                        forceUpdate();
                        if (isGhostActive) syncState();
                    }}
                />
                <Menu.MenuCheckboxItem
                    id="opt-deafen"
                    label={t("Fake Deafen")}
                    checked={configFakeDeafen}
                    action={() => {
                        configFakeDeafen = !configFakeDeafen;
                        forceUpdate();
                        if (isGhostActive) syncState();
                    }}
                />
            </Menu.MenuGroup>
        </Menu.Menu>
    );
}

function FakeDeafenUserButton({ iconForeground, hideTooltips, nameplate }: UserAreaRenderProps & { hideTooltips?: boolean }) {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    return (
        <UserAreaButton
            onClick={() => {
                isGhostActive = !isGhostActive;
                syncState();
                forceUpdate();
            }}
            onContextMenu={(e: React.MouseEvent) => ContextMenuApi.openContextMenu(e, () => <GhostContextMenu />)}
            tooltipText={hideTooltips ? undefined : isGhostActive ? t("Disable Fake Voice") : t("Enable Fake Voice (Right: Config)")}
            icon={<FakeDeafenIcon className={iconForeground} />}
            role="switch"
            aria-checked={isGhostActive}
            redGlow={false}
            plated={nameplate != null}
        />
    );
}

export default definePlugin({
    name: "FakeVoice",
    enabledByDefault: true,
    description: "Appear muted or deaf while listening. By mushzi.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    dependencies: ["CommandsAPI", "UserAreaAPI"],

    start() {
        const socket = getGatewaySocket();
        if (socket) hookSocket(socket);

        FluxDispatcher.subscribe("AUDIO_TOGGLE_SELF_MUTE", onVoiceChange);
        FluxDispatcher.subscribe("AUDIO_TOGGLE_SELF_DEAF", onVoiceChange);
        FluxDispatcher.subscribe("VOICE_CHANNEL_SELECT", onVoiceChange);
        FluxDispatcher.subscribe("RTC_CONNECTION_STATE", onVoiceChange);
        if (isGhostActive && SelectedChannelStore?.getVoiceChannelId?.()) {
            syncState();
        }
    },

    stop() {
        FluxDispatcher.unsubscribe("AUDIO_TOGGLE_SELF_MUTE", onVoiceChange);
        FluxDispatcher.unsubscribe("AUDIO_TOGGLE_SELF_DEAF", onVoiceChange);
        FluxDispatcher.unsubscribe("VOICE_CHANNEL_SELECT", onVoiceChange);
        FluxDispatcher.unsubscribe("RTC_CONNECTION_STATE", onVoiceChange);
        if (isGhostActive) {
            isGhostActive = false;
            syncState();
        }
        unhookSocket();
    },

    userAreaButton: {
        icon: FakeDeafenIcon,
        render: FakeDeafenUserButton
    },

    commands: [
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "fakemute",
            description: "Toggle Fake Mute",
            execute: async (_, ctx) => {
                configFakeMute = !configFakeMute;
                isGhostActive = configFakeMute;
                syncState();
                sendBotMessage(ctx.channel.id, { content: `**Fake Mute** is ${isGhostActive ? t("enabled") : t("disabled")}.` });
            },
        },
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "fakedeafen",
            description: "Toggle Fake Deafen",
            execute: async (_, ctx) => {
                configFakeDeafen = !configFakeDeafen;
                isGhostActive = configFakeDeafen;
                syncState();
                sendBotMessage(ctx.channel.id, { content: `**Fake Deafen** is ${isGhostActive ? t("enabled") : t("disabled")}.` });
            },
        },
        {
            inputType: ApplicationCommandInputType.BUILT_IN,
            name: "fakedeafen_mute",
            description: "Toggle Fake Deafen & Mute simultaneously",
            execute: async (_, ctx) => {
                const next = !(configFakeMute && configFakeDeafen);
                configFakeMute = next;
                configFakeDeafen = next;
                isGhostActive = next;
                syncState();
                sendBotMessage(ctx.channel.id, { content: `**Fake Deafen & Mute** are ${isGhostActive ? t("enabled") : t("disabled")}.` });
            },
        },
    ]
});
