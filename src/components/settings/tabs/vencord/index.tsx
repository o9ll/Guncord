/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./VencordTab.css";

import { isCompactModeEnabled, isStealthModeEnabled, toggleCompactMode, toggleStealthMode } from "@api/HeaderBar";
import { openNotificationLogModal } from "@api/Notifications/notificationLog";
import { plugins } from "@api/PluginManager";
import { useSettings } from "@api/Settings";
import { t } from "@api/i18n";

import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Divider } from "@components/Divider";
import { Flex } from "@components/Flex";
import { FormSwitch } from "@components/FormSwitch";
import { Heading } from "@components/Heading";
import { HeartIcon, GithubIcon, LogIcon, OwnerCrownIcon, PaintbrushIcon, PlanetIcon, RestartIcon } from "@components/Icons";
import { Notice } from "@components/Notice";
import { Paragraph } from "@components/Paragraph";
import { openPluginModal, SettingsTab, wrapTab } from "@components/settings";
import { QuickAction, QuickActionCard } from "@components/settings/QuickAction";
import { IS_MAC, IS_WINDOWS } from "@utils/constants";
import { classNameFactory } from "@utils/css";
import { Margins } from "@utils/margins";
import { identity } from "@utils/misc";
import { openModal } from "@utils/modal";
import { relaunch } from "@utils/native";
import { Avatar, OAuth2AuthorizeModal, React, Select, UserStore } from "@webpack/common";

import { ContributeModal } from "../../../../guncord/renderer/components/ContributeModal";
import { openNotificationSettingsModal } from "./NotificationSettings";

const cl = classNameFactory("vc-vencord-tab-");

const DEV_TEAM_IDS = [
    {
        id: "1020801845490356245",
        role: "Creator",
        description: "Manager of app, site visuals, communication & ads"
    },
    {
        id: "1020801845490356245",
        role: "Admin",
        description: "Manager of infrastructure, API, bot & network hosting"
    }
];

function useDiscordUser(userId: string) {
    const [user, setUser] = React.useState<{ name: string; pfp: string; } | null>(null);
    React.useEffect(() => {
        const cached = UserStore?.getUser(userId);
        if (cached) {
            setUser({
                name: cached.username,
                pfp: cached.avatar
                    ? `https://cdn.discordapp.com/avatars/${userId}/${cached.avatar}.webp?size=128`
                    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) >> 22n) % 6}.png`
            });
            return;
        }
        fetch(`https://discord.com/api/v9/users/${userId}`, {
            headers: { Authorization: (window as any).token ?? "" }
        })
            .then(r => r.json())
            .then(u => setUser({
                name: u.username ?? userId,
                pfp: u.avatar
                    ? `https://cdn.discordapp.com/avatars/${userId}/${u.avatar}.webp?size=128`
                    : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(userId) >> 22n) % 6}.png`
            }))
            .catch(() => setUser({ name: userId, pfp: `https://cdn.discordapp.com/embed/avatars/0.png` }));
    }, [userId]);
    return user;
}

function DevCard({ id, role, description }: { id: string; role: string; description: string; }) {
    const user = useDiscordUser(id);
    return (
        <Card variant="primary" outline style={{ padding: "12px" }}>
            <Flex align={Flex.Align.CENTER} gap="12px">
                <Avatar
                    src={user?.pfp ?? `https://cdn.discordapp.com/embed/avatars/0.png`}
                    size="SIZE_48"
                />
                <Flex direction={Flex.Direction.VERTICAL} style={{ flex: 1, gap: "2px" }}>
                    <Heading tag="h3" style={{ marginBottom: "0px" }}>{user?.name ?? "..."}</Heading>
                    <Heading tag="h4" style={{ color: "var(--brand-experiment)", fontWeight: "bold" }}>{role}</Heading>
                    <Paragraph size="xs" color="text-muted" style={{ fontSize: "12px", lineHeight: "1.3" }}>{description}</Paragraph>
                </Flex>
            </Flex>
        </Card>
    );
}

function DevTeamSection() {
    const [showDevs, setShowDevs] = React.useState(false);

    return (
        <>
            <QuickActionCard>
                <QuickAction
                    Icon={GithubIcon}
                    text="Source"
                    action={() => (typeof VencordNative !== "undefined" && VencordNative?.native?.openExternal) ? VencordNative.native.openExternal("https://github.com/o9ll/Guncord") : window.open("https://github.com/o9ll/Guncord", "_blank")}
                />
                <QuickAction
                    Icon={PaintbrushIcon}
                    text="CSS"
                    action={() => typeof VencordNative !== "undefined" && VencordNative?.quickCss?.openEditor?.()}
                />
                {!IS_WEB && (
                    <QuickAction
                        Icon={RestartIcon}
                        text="Restart"
                        action={relaunch}
                    />
                )}
                <QuickAction
                    Icon={HeartIcon}
                    text="Contribute"
                    action={() => openModal(props => <ContributeModal {...props} />)}
                />
                <QuickAction
                    Icon={OwnerCrownIcon}
                    text="Dev"
                    action={() => setShowDevs(!showDevs)}
                />
                <QuickAction
                    Icon={GithubIcon}
                    text="o9"
                    action={() => (typeof VencordNative !== "undefined" && VencordNative?.native?.openExternal) ? VencordNative.native.openExternal("https://github.com/o9ll") : window.open("https://github.com/o9ll", "_blank")}
                />
            </QuickActionCard>

            {showDevs && (
                <div style={{ marginTop: "16px", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px", animation: "slideIn 0.3s ease-out" }}>
                    <style>{`
                        @keyframes slideIn {
                            from { opacity: 0; transform: translateY(-10px); }
                            to { opacity: 1; transform: translateY(0); }
                        }
                    `}</style>
                    {DEV_TEAM_IDS.map(dev => (
                        <DevCard key={dev.id} id={dev.id} role={dev.role} description={dev.description} />
                    ))}
                </div>
            )}
        </>
    );
}

type KeysOfType<Object, Type> = {
    [K in keyof Object]: Object[K] extends Type ? K : never;
}[keyof Object];

function useCompactActive() {
    const [active, setActive] = React.useState(isCompactModeEnabled);
    React.useEffect(() => {
        const handler = () => setActive(isCompactModeEnabled());
        window.addEventListener("guncord-compact-change", handler);
        return () => window.removeEventListener("guncord-compact-change", handler);
    }, []);
    return active;
}

function useStealthActive() {
    const [active, setActive] = React.useState(isStealthModeEnabled);
    React.useEffect(() => {
        const handler = () => setActive(isStealthModeEnabled());
        window.addEventListener("guncord-stealth-change", handler);
        return () => window.removeEventListener("guncord-stealth-change", handler);
    }, []);
    return active;
}

function StealthModeSection() {
    const enabled = useStealthActive();

    return (
        <>
            <Heading className={Margins.top20}>{t("Stealth Mode")}</Heading>
            <Paragraph className={Margins.bottom16}>
                {enabled
                    ? "Stealth mode is enabled — all visual elements are hidden. Shortcut: Ctrl+Shift+H"
                    : t("Hides all visual elements without disabling plugins. Shortcut: Ctrl+Shift+H")}
            </Paragraph>
            <Button
                onClick={toggleStealthMode}
                variant={enabled ? "secondary" : "primary"}
            >
                {enabled ? t("Stealth Mode") : t("Stealth Mode")}
            </Button>
        </>
    );
}

function StealthModeButton() {
    const enabled = useStealthActive();

    return (
        <Button
            onClick={toggleStealthMode}
            variant={enabled ? "dangerPrimary" : "primary"}
        >
            {enabled ? t("✓ Stealth Mode") : t("Stealth Mode")}
        </Button>
    );
}

function EquicordSettings() {
    const settings = useSettings();
    const stealthActive = useStealthActive();
    const compactActive = useCompactActive();

    const needsVibrancySettings = IS_DISCORD_DESKTOP && IS_MAC;

    const user = UserStore?.getCurrentUser();

    const Switches: Array<false | {
        key: KeysOfType<typeof settings, boolean>;
        title: string;
        description?: string;
        restartRequired?: boolean;
        warning: { enabled: boolean; message?: string; };
    }>
        = [

            {
                key: "useQuickCss",
                title: t("Enable Custom CSS"),
                restartRequired: true,
                warning: { enabled: false },
            },
            !IS_WEB && {
                key: "enableReactDevtools",
                title: t("Enable React Developer Tools"),
                restartRequired: true,
                warning: { enabled: false },
            },
            (!IS_WEB && !IS_DISCORD_DESKTOP || !IS_WINDOWS) && {
                key: "mainWindowFrameless",
                title: t("Disable the Main Window Frame"),
                restartRequired: true,
                warning: { enabled: false },
            },
            !IS_WEB &&
            (!IS_DISCORD_DESKTOP || !IS_WINDOWS
                ? {
                    key: "frameless",
                    title: t("Disable All Window Frames"),
                    restartRequired: true,
                    warning: { enabled: false },
                }
                : {
                    key: "winNativeTitleBar",
                    title: t("Use Windows native title bar"),
                    restartRequired: true,
                    warning: { enabled: false },
                }
            ),

            !IS_WEB && {
                key: "transparent",
                title: t("Enable Window Transparency"),
                restartRequired: true,
                warning: {
                    enabled: false,
                    message: IS_WINDOWS
                        ? t("This will stops window resizing and edge snapping.")
                        : t("This will stop the window from being resizable."),
                },
            },
            IS_DISCORD_DESKTOP && {
                key: "disableMinSize",
                title: t("Disable Minimum Window Size"),
                restartRequired: true,
                warning: { enabled: false },
            },
            !IS_WEB &&
            IS_WINDOWS && {
                key: "winCtrlQ",
                title: t("Register Ctrl+Q as shortcut to close Discord"),
                restartRequired: true,
                warning: { enabled: false },
            },
            !IS_WEB && {
                key: "streamProof",
                title: t("Enable Stream Proof"),
                restartRequired: false,
                warning: { enabled: false },
            },
            !IS_WEB && {
                key: "disableAutoUpdate",
                title: t("Disable Auto Update"),
                restartRequired: false,
                warning: { enabled: false },
            },
        ];

    return (
        <SettingsTab>

            {!stealthActive && (<>

                <Divider className={Margins.top20} />

                <Heading className={Margins.top16}>{t("Quick")}</Heading>

                <DevTeamSection />

                <Divider className={Margins.top20} />

                <Heading className={Margins.top20}>{t("Settings")}</Heading>
                <Notice.Info className={Margins.bottom20} style={{ width: "100%" }}>
                    {t("Customize")} {" "}
                    <a
                        role="button"
                        onClick={() => openPluginModal(plugins.Settings)}
                        style={{ cursor: "pointer", color: "var(--text-link)" }}
                    >
                        {t("Section")}
                    </a>
                </Notice.Info>

                {Switches.filter((s): s is Exclude<typeof s, false> => !!s).map(
                    s => (
                        <FormSwitch
                            key={s.key}
                            value={settings[s.key]}
                             onChange={v => {
                                 settings[s.key] = v;
                                 if (s.key === "streamProof" && typeof VencordNative !== "undefined") {
                                     VencordNative?.setContentProtection?.(v);
                                 }
                             }}
                            title={s.title}
                            description={
                                s.warning.enabled ? (
                                    <>
                                        {s.description}
                                        <Notice.Warning className={Margins.top8} style={{ width: "100%" }}>
                                            {s.warning.message}
                                        </Notice.Warning>
                                    </>
                                ) : (
                                    s.description
                                )
                            }
                            hideBorder
                        />
                    ),
                )}

                {needsVibrancySettings && (
                    <>
                        <Divider className={Margins.top20} />

                        <Heading className={Margins.top20}>Window Vibrancy</Heading>
                        <Paragraph className={Margins.bottom16}>
                            Customize the macOS window vibrancy effect. This controls the blur and transparency style of the Discord window. Changes require a restart to take effect.
                        </Paragraph>
                        <Select
                            className={Margins.bottom20}
                            placeholder="Window vibrancy style"
                            options={[
                                // Sorted from most opaque to most transparent
                                {
                                    label: "No vibrancy",
                                    value: undefined,
                                },
                                {
                                    label: "Under Page (window tinting)",
                                    value: "under-page",
                                },
                                {
                                    label: "Content",
                                    value: "content",
                                },
                                {
                                    label: "Window",
                                    value: "window",
                                },
                                {
                                    label: "Selection",
                                    value: "selection",
                                },
                                {
                                    label: "Titlebar",
                                    value: "titlebar",
                                },
                                {
                                    label: "Header",
                                    value: "header",
                                },
                                {
                                    label: "Sidebar",
                                    value: "sidebar",
                                },
                                {
                                    label: "Tooltip",
                                    value: "tooltip",
                                },
                                {
                                    label: "Menu",
                                    value: "menu",
                                },
                                {
                                    label: "Popover",
                                    value: "popover",
                                },
                                {
                                    label: "Fullscreen UI (transparent but slightly muted)",
                                    value: "fullscreen-ui",
                                },
                                {
                                    label: "HUD (Most transparent)",
                                    value: "hud",
                                },
                            ]}
                            select={v => (settings.macosVibrancyStyle = v)}
                            isSelected={v => settings.macosVibrancyStyle === v}
                            serialize={identity}
                        />
                    </>
                )}

                <Divider className={Margins.top20} />

                <Heading className={Margins.top20}>{t("Notifications")}</Heading>

                <Flex gap="16px">
                    <Button onClick={openNotificationSettingsModal}>
                        {t("Settings")}
                    </Button>
                    <Button variant="secondary" onClick={openNotificationLogModal}>
                        {t("Logs")}
                    </Button>
                </Flex>

            </>)}

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>{t("Compact")}</Heading>
            <Button
                onClick={toggleCompactMode}
                variant={compactActive ? "dangerPrimary" : "primary"}
            >
                {compactActive ? t("✓ Compact Mode") : t("Compact Mode")}
            </Button>

            <Divider className={Margins.top20} />

            <Heading className={Margins.top20}>{t("Stealth")}</Heading>
            <StealthModeButton />

        </SettingsTab>
    );
}

export default wrapTab(EquicordSettings, "Guncord Settings");

