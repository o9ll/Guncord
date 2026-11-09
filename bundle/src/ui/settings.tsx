/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByName, findByProps } from "../metro";
import { Navigation, React, ReactNative } from "../metro/common";
import { after } from "../patcher";
import { isPluginEnabled, plugins, setPluginEnabled } from "../plugins";
import { GuncordLogoIcon } from "./icons";

export function GuncordSettingsScreen() {
    const R = React.current;
    const RN = ReactNative.current;
    if (!R || !RN) return null;

    const [pluginStates, setPluginStates] = R.useState(() => {
        const initial: Record<string, boolean> = {};
        for (const [name] of plugins) {
            initial[name] = isPluginEnabled(name);
        }
        return initial;
    });

    const toggle = (name: string) => {
        const next = !pluginStates[name];
        setPluginStates((prev: any) => ({ ...prev, [name]: next }));
        setPluginEnabled(name, next);
    };

    const pluginList = Array.from(plugins.values());

    return R.createElement(
        RN.ScrollView,
        {
            style: {
                flex: 1,
                backgroundColor: "#1e1f22",
                padding: 16
            }
        },
        // Header section
        R.createElement(
            RN.View,
            {
                style: {
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 20,
                    paddingBottom: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: "#2b2d31"
                }
            },
            R.createElement(GuncordLogoIcon, { size: 36, color: "#5865F2" }),
            R.createElement(
                RN.View,
                { style: { marginLeft: 12 } },
                R.createElement(
                    RN.Text,
                    {
                        style: {
                            color: "#ffffff",
                            fontSize: 20,
                            fontWeight: "bold"
                        }
                    },
                    "Guncord Mobile"
                ),
                R.createElement(
                    RN.Text,
                    {
                        style: {
                            color: "#949ba4",
                            fontSize: 13,
                            marginTop: 2
                        }
                    },
                    "v1.31.7 - Hermes React Native Bundle"
                )
            )
        ),
        // Section Title
        R.createElement(
            RN.Text,
            {
                style: {
                    color: "#949ba4",
                    fontSize: 12,
                    fontWeight: "bold",
                    textTransform: "uppercase",
                    marginBottom: 10,
                    letterSpacing: 0.5
                }
            },
            "Plugins Management"
        ),
        // Plugin list
        pluginList.length === 0
            ? R.createElement(
                RN.Text,
                {
                    style: {
                        color: "#949ba4",
                        fontSize: 14,
                        fontStyle: "italic",
                        marginVertical: 12
                    }
                },
                "No mobile plugins installed yet."
            )
            : pluginList.map(plugin => {
                const enabled = pluginStates[plugin.name] ?? false;
                return R.createElement(
                    RN.View,
                    {
                        key: plugin.name,
                        style: {
                            backgroundColor: "#2b2d31",
                            borderRadius: 8,
                            padding: 14,
                            marginBottom: 10,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between"
                        }
                    },
                    R.createElement(
                        RN.View,
                        { style: { flex: 1, marginRight: 12 } },
                        R.createElement(
                            RN.Text,
                            {
                                style: {
                                    color: "#ffffff",
                                    fontSize: 16,
                                    fontWeight: "600"
                                }
                            },
                            plugin.name
                        ),
                        R.createElement(
                            RN.Text,
                            {
                                style: {
                                    color: "#949ba4",
                                    fontSize: 13,
                                    marginTop: 4,
                                    lineHeight: 18
                                }
                            },
                            plugin.description
                        )
                    ),
                    R.createElement(RN.Switch, {
                        value: enabled,
                        onValueChange: () => toggle(plugin.name),
                        trackColor: { false: "#4e5058", true: "#5865F2" },
                        thumbColor: enabled ? "#ffffff" : "#dbdee1"
                    })
                );
            })
    );
}

export function patchSettings(): void {
    const SettingsOverview = findByName("UserSettingsOverviewScreen") || findByName("SettingsOverviewScreen") || findByProps("UserSettingsOverviewScreen");
    if (!SettingsOverview) return;

    const target = SettingsOverview.default ?? SettingsOverview;
    if (typeof target === "function") {
        after(SettingsOverview, SettingsOverview.default ? "default" : "render", (_, res) => {
            const R = React.current;
            const RN = ReactNative.current;
            if (!R || !RN || !res) return res;

            try {
                // Insert Guncord Settings button
                const row = R.createElement(
                    RN.TouchableOpacity,
                    {
                        style: {
                            flexDirection: "row",
                            alignItems: "center",
                            paddingVertical: 12,
                            paddingHorizontal: 16,
                            backgroundColor: "#2b2d31",
                            borderRadius: 8,
                            marginHorizontal: 16,
                            marginVertical: 8
                        },
                        onPress: () => {
                            Navigation.current?.push("GuncordSettings", {
                                render: () => R.createElement(GuncordSettingsScreen)
                            });
                        }
                    },
                    R.createElement(GuncordLogoIcon, { size: 24 }),
                    R.createElement(
                        RN.Text,
                        {
                            style: {
                                color: "#ffffff",
                                fontSize: 16,
                                fontWeight: "600",
                                marginLeft: 12
                            }
                        },
                        "Guncord"
                    )
                );

                if (Array.isArray(res.props?.children)) {
                    res.props.children.unshift(row);
                }
            } catch {}

            return res;
        });
    }
}

