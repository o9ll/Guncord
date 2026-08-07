/*
 * Guncord, a modification for Discord's desktop app
 * Copyright (c) 2026 o9
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import "./styles.css";

import * as DataStore from "@api/DataStore";
import { isPluginEnabled, startPlugin, stopPlugin } from "@api/PluginManager";
import { Settings, useSettings } from "@api/Settings";
import { Button } from "@components/Button";
import { Card } from "@components/Card";
import { Notice } from "@components/Notice";
import { Divider } from "@components/Divider";
import ErrorBoundary from "@components/ErrorBoundary";
import { HeadingTertiary } from "@components/Heading";
import { Paragraph } from "@components/Paragraph";
import { SettingsTab } from "@components/settings";
import { debounce } from "@shared/debounce";
import { ChangeList } from "@utils/ChangeList";
import { classNameFactory } from "@utils/css";
import { isTruthy } from "@utils/guards";
import { Logger } from "@utils/Logger";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { relaunch, showItemInFolder } from "@utils/native";
import { useAwaiter } from "@utils/react";
import { Alerts, lodash, Parser, React, Select as DiscordSelect, TextInput, Toasts, Tooltip, useCallback, useMemo, useState } from "@webpack/common";
import { SafeSearchableSelect } from "@components/SafeSearchableSelect";
import { JSX } from "react";
import { t } from "@api/i18n";

import Plugins, { ExcludedPlugins, PluginMeta } from "~plugins";

import { PluginCard } from "./PluginCard";
import { openPluginModal, openResetDefaultsModal, openWarningModal } from "./PluginModal";
import { StockPluginsCard } from "./PluginStatCards";
import { TUTORIAL_PLUGIN_NAMES } from "./tutorialList";
import { UIElementsButton } from "./UIElements";

const GUNCORD_TAB_ICON = "data:image/png;base64,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";
const VENCORD_EQUICORD_TAB_ICON = "data:image/png;base64,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";
const UserPlugins_TAB_ICON = "data:image/png;base64,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";

function GuncordTabIcon() {
    return <img src={GUNCORD_TAB_ICON} alt="Guncord" style={{ width: 18, height: 18, borderRadius: 4 }} />;
}

function VencordEquicordTabIcon() {
    return <img src={VENCORD_EQUICORD_TAB_ICON} alt="Vencord & Equicord" style={{ width: 18, height: 18, borderRadius: 4 }} />;
}

function UserPluginsTabIcon() {
    return <img src={UserPlugins_TAB_ICON} alt="Plugins" style={{ width: 18, height: 18, borderRadius: 4 }} />;
}

const makeCategoryOptions = (othersCount?: number) => [
    { label: "Vencord & Equicord", value: SearchStatus.OTHERS },
    { label: "Guncord", value: SearchStatus.GUNCORD },
    { label: t("User Plugins"), value: SearchStatus.USER_PLUGINS },
    { label: t("Community Plugins"), value: "community", disabled: true }
];
export const cl = classNameFactory("vc-plugins-");
export const logger = new Logger("PluginSettings", "#a6d189");

function showErrorToast(message: string) {
    Toasts.show({
        message,
        type: Toasts.Type.FAILURE,
        id: Toasts.genId(),
        options: {
            position: Toasts.Position.BOTTOM
        }
    });
}

function ReloadRequiredCard({ required, enabledPlugins, openWarningModal, resetCheckAndDo, applyDefaultConfigCheckAndDo }) {
    return (
        <Card className={classes(cl("info-card"), required && "vc-warning-card")}>
            {required ? (
                <>
                    <HeadingTertiary>{t("Restart required!")}</HeadingTertiary>
                    <Paragraph className={cl("dep-text")}>
                        {t("Restart now to apply new plugins and their settings")}
                    </Paragraph>
                    <Button variant="primary" className={cl("restart-button")} onClick={() => relaunch()}>
                        {t("Restart")}
                    </Button>
                </>
            ) : (
                <>
                    <HeadingTertiary>{t("Plugin Management")}</HeadingTertiary>
                    <Paragraph>{t("Press the cog wheel or info icon to get more info on a plugin")}</Paragraph>
                    <Paragraph>{t("Plugins with a cog wheel have settings you can modify!")}</Paragraph>
                </>
            )}
            <div style={{ display: "flex", gap: "8px" }}>
                {enabledPlugins.length > 0 && !required && (
                    <Button
                        variant="secondary"
                        size="small"
                        className={"vc-plugins-disable-warning vc-modal-align-reset"}
                        onClick={() => {
                            return openWarningModal(null, undefined, false, enabledPlugins.length, resetCheckAndDo);
                        }}
                    >
                        {t("Disable All Plugins")}
                    </Button>
                )}
                {!required && (
                    <Button
                        variant="secondary"
                        size="small"
                        className={"vc-plugins-disable-warning vc-modal-align-reset"}
                        onClick={() => {
                            return openResetDefaultsModal(applyDefaultConfigCheckAndDo);
                        }}
                    >
                        {t("Apply Default Config")}
                    </Button>
                )}
            </div>
        </Card>
    );
}

export const ExcludedReasons: Record<"web" | "discordDesktop" | "vesktop" | "equibop" | "desktop" | "dev", string> = {
    desktop: "Discord Desktop app or Vesktop/Equibop",
    discordDesktop: "Discord Desktop app",
    vesktop: "Vesktop/Equibop apps",
    equibop: "Vesktop/Equibop apps",
    web: "Vesktop/Equibop apps & Discord web",
    dev: "Developer version of Guncord"
};

function ExcludedPluginsList({ search }: { search: string; }) {
    const matchingExcludedPlugins = search
        ? Object.entries(ExcludedPlugins)
            .filter(([name]) => name.toLowerCase().includes(search))
        : [];

    return (
        <Paragraph className={Margins.top16}>
            {matchingExcludedPlugins.length
                ? <>
                    <Paragraph>{t("Are you looking for:")}</Paragraph>
                    <ul>
                        {matchingExcludedPlugins.map(([name, reason]) => (
                            <li key={name}>
                                <b>{name}</b>: Only available on the {ExcludedReasons[reason]}
                            </li>
                        ))}
                    </ul>
                </>
                : t("No plugins meet the search criteria.")
            }
        </Paragraph>
    );
}

import { SearchStatus, TUTORIAL_CACHE } from "./components/Common";

// Fallback select natif si le composant Discord n'est pas trouvé
function NativeSelect({ options, select, isSelected }: any) {
    const currentVal = options.find((o: any) => isSelected(o.value))?.value ?? options.find((o: any) => o.default)?.value ?? options[0]?.value;
    return (
        <select
            style={{
                background: "var(--background-secondary)",
                color: "var(--text-normal)",
                border: "1px solid var(--background-modifier-accent)",
                borderRadius: 4,
                padding: "6px 10px",
                fontSize: 14,
                cursor: "pointer",
                outline: "none",
            }}
            value={currentVal}
            onChange={e => select(Number(e.target.value))}
        >
            {options.map((o: any) => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
    );
}

const Select = DiscordSelect || NativeSelect;
interface PluginSettingsProps {
    premiumOnly?: boolean;
}

export default function PluginSettings({ premiumOnly = false }: PluginSettingsProps) {
    const settings = useSettings();
    const changes = React.useMemo(() => new ChangeList<string>(), []);

    // Expand Discord's content column to fill the full available width
    React.useEffect(() => {
        const col = document.querySelector<HTMLElement>('[class*="contentColumn"]');
        if (!col) return;
        const prevPaddingLeft = col.style.paddingLeft;
        const prevPaddingRight = col.style.paddingRight;
        const prevMaxWidth = col.style.maxWidth;
        col.style.paddingLeft = "16px";
        col.style.paddingRight = "16px";
        col.style.maxWidth = "none";
        return () => {
            col.style.paddingLeft = prevPaddingLeft;
            col.style.paddingRight = prevPaddingRight;
            col.style.maxWidth = prevMaxWidth;
        };
    }, []);

    // Static list — no fetch, no CORS issues.
    // Also populate TUTORIAL_CACHE so the SearchStatus.TUTORIAL filter works.
    const tutorialPlugins = useMemo(() => {
        for (const name of Object.values(Plugins).map(p => p.name).filter(Boolean)) {
            TUTORIAL_CACHE.set(name, TUTORIAL_PLUGIN_NAMES.has(name));
        }
        return TUTORIAL_PLUGIN_NAMES;
    }, []);

    React.useEffect(() => {
        return () => {
            if (!changes.hasChanges) return;

            const allChanges = [...changes.getChanges()];
            const pluginNames = [...new Set(allChanges.map(s => s.split(":")[0]))];
            const maxDisplay = 15;
            const displayed = pluginNames.slice(0, maxDisplay);
            const remainingCount = pluginNames.length - displayed.length;

            Alerts.show({
                title: "Restart required",
                body: (
                    <div>
                        {displayed.map((s, i) => (
                            <span key={i}>
                                {i > 0 && ", "}
                                {Parser.parse("`" + s + "`")}
                            </span>
                        ))}
                        {remainingCount > 0 && <span> and {remainingCount} more</span>}
                    </div>
                ),
                confirmText: "Restart now",
                cancelText: "Later!",
                onConfirm: () => relaunch()
            });
        };
    }, []);

    const depMap = useMemo(() => {
        const o = {} as Record<string, string[]>;
        for (const plugin in Plugins) {
            const deps = Plugins[plugin].dependencies;
            if (deps) {
                for (const dep of deps) {
                    o[dep] ??= [];
                    o[dep].push(plugin);
                }
            }
        }
        return o;
    }, []);

    const sortedPlugins = useMemo(() => Object.values(Plugins)
        .filter(p => typeof p.name === "string")
        .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? "")), []);

    const hasUserPlugins = useMemo(() => !IS_STANDALONE && Object.values(PluginMeta).some(m => m.userPlugin), []);

    const [searchValue, setSearchValue] = useState({ value: "", status: SearchStatus.GUNCORD });
    const [searchInput, setSearchInput] = useState("");

    const debouncedSetSearch = useMemo(
        () => debounce((query: string) => setSearchValue(prev => ({ ...prev, value: query })), 150),
        []
    );

    const search = searchValue.value.toLowerCase();
    const onSearch = useCallback((query: string) => {
        setSearchInput(query);
        debouncedSetSearch(query);
    }, [debouncedSetSearch]);

    const BATCH_SIZE = 40;
    const [visibleCount, setVisibleCount] = React.useState(BATCH_SIZE);

    const observer = React.useRef<IntersectionObserver>();
    const sentinelRef = React.useCallback((node: HTMLDivElement | null) => {
        if (observer.current) observer.current.disconnect();
        if (node) {
            observer.current = new IntersectionObserver(
                entries => {
                    if (entries[0].isIntersecting) {
                        const total = allDataLengthRef.current;
                        React.startTransition(() => {
                            setVisibleCount(v => Math.min(v + BATCH_SIZE, total));
                        });
                    }
                },
                { rootMargin: "400px" } // trigger loading before it comes into view
            );
            observer.current.observe(node);
        }
    }, []);

    const onStatusChange = useCallback((status: SearchStatus) => {
        setVisibleCount(BATCH_SIZE);
        React.startTransition(() => {
            setSearchValue(prev => ({ ...prev, status }));
        });
    }, []);

    const pluginFilter = useCallback((plugin: typeof Plugins[keyof typeof Plugins], newPluginsSet: Set<string> | null) => {
        // Filter by premium status first
        const isPremiumPlugin = !!plugin.premium;
        if (premiumOnly) {
            if (!isPremiumPlugin) return false;
        } else {
            if (isPremiumPlugin) return false;
        }

        const { status } = searchValue;
        const enabled = isPluginEnabled(plugin.name);

        const pluginMeta = PluginMeta[plugin.name];

        switch (status) {
            case SearchStatus.DISABLED:
                if (enabled) return false;
                break;
            case SearchStatus.ENABLED:
                if (!enabled) return false;
                break;
            case SearchStatus.GUNCORD:
                if (!pluginMeta?.folderName?.startsWith("src/guncordplugins/")) return false;
                break;
            case SearchStatus.OTHERS:
                if (pluginMeta?.folderName?.startsWith("src/guncordplugins/") || pluginMeta?.folderName?.startsWith("src/plugins/_")) return false;
                if (!pluginMeta?.folderName?.startsWith("src/plugins/")) return false;
                break;
            case SearchStatus.VENCORD:
                if (!pluginMeta?.folderName?.startsWith("src/plugins/")) return false;
                break;
            case SearchStatus.NEW:
                if (!newPluginsSet?.has(plugin.name)) return false;
                break;
            case SearchStatus.USER_PLUGINS:
                if (!pluginMeta?.userPlugin) return false;
                break;
            case SearchStatus.API_PLUGINS:
                if (!plugin.name.endsWith("API")) return false;
                break;
            case SearchStatus.TUTORIAL:
                if (!TUTORIAL_CACHE.get(plugin.name)) return false;
                break;
        }

        if (!search.length) return true;

        const isGuncordPartner = (
            plugin.name === "DynamicIslande" ||
            plugin.name === "StereoInstaller" ||
            plugin.name === "ClientDiagnostics" ||
            plugin.name === "SecureBookmarks" ||
            plugin.name === "StatusCycler" ||
            plugin.name === "MutualScanner"
        );

        if ((search.includes("guncord") || search.includes("gun")) && isGuncordPartner) {
            return true;
        }

        return (
            plugin.name.toLowerCase().includes(search.replace(/\s+/g, "")) ||
            plugin.description.toLowerCase().includes(search) ||
            plugin.tags?.some(t => t.toLowerCase().includes(search))
        );
    }, [searchValue, search]);

    const [newPluginsSet] = useAwaiter(() => DataStore.get("Vencord_existingPlugins").then((cachedPlugins: Record<string, number> | undefined) => {
        const now = Date.now() / 1000;
        const existingTimestamps: Record<string, number> = {};
        const sortedPluginNames = Object.values(sortedPlugins).map(plugin => plugin.name);

        const newPlugins: string[] = [];
        for (const { name: p } of sortedPlugins) {
            const time = existingTimestamps[p] = cachedPlugins?.[p] ?? now;
            if ((time + 60 * 60 * 24 * 2) > now) {
                newPlugins.push(p);
            }
        }
        DataStore.set("Vencord_existingPlugins", existingTimestamps);

        return lodash.isEqual(newPlugins, sortedPluginNames) ? null : new Set(newPlugins);
    }));

    const handleRestartNeeded = useCallback((name: string, key: string) => changes.handleChange(`${name}:${key}`), [changes]);

    // Only filter/categorize plugin DATA here — no JSX created yet
        const { guncordData, othersData, requiredData } = useMemo(() => {
        const guncordData: typeof sortedPlugins = [];
        const othersData: typeof sortedPlugins = [];
        const requiredData: typeof sortedPlugins = [];

        const showApi = searchValue.status === SearchStatus.API_PLUGINS;
        for (const p of sortedPlugins) {
            if (p.hidden || (!p.settings?.def && p.name.endsWith("API") && !showApi))
                continue;

            if (!pluginFilter(p, newPluginsSet)) continue;

            const isRequired = p.required || p.isDependency || depMap[p.name]?.some(d => isPluginEnabled(d));

            if (isRequired) {
                requiredData.push(p);
            } else {
                const folderName = PluginMeta[p.name]?.folderName ?? "";
                if (folderName.startsWith("src/guncordplugins/")) {
                    guncordData.push(p);
                } else {
                    othersData.push(p);
                }
            }
        }
        return { guncordData, othersData, requiredData };
    }, [sortedPlugins, searchValue, newPluginsSet, depMap, pluginFilter]);

    const allDataLength = guncordData.length + othersData.length;
    const hasMore = visibleCount < allDataLength;

    // Store allDataLength in a ref so the observer callback always sees the latest value
    // without needing it as a dependency (which would cause reconnect loops).
    const allDataLengthRef = React.useRef(allDataLength);
    allDataLengthRef.current = allDataLength;

    // Sentinel ref and observer are now defined using a callback ref above.

    function resetCheckAndDo() {
        let restartNeeded = false;

        for (const plugin of enabledPlugins) {
            const pluginSettings = settings.plugins[plugin];

            if (Plugins[plugin].patches?.length) {
                pluginSettings.enabled = false;
                changes.handleChange(plugin);
                restartNeeded = true;
                continue;
            }

            const result = stopPlugin(Plugins[plugin]);

            if (!result) {
                logger.error(`Error while stopping plugin ${plugin}`);
                showErrorToast(`Error while stopping plugin ${plugin}`);
                continue;
            }

            pluginSettings.enabled = false;
        }

        if (restartNeeded) {
            Alerts.show({
                title: "Restart Required",
                body: (
                    <>
                        <p style={{ textAlign: "center" }}>Some plugins require a restart to fully disable.</p>
                        <p style={{ textAlign: "center" }}>Would you like to restart now?</p>
                    </>
                ),
                confirmText: "Restart Now",
                cancelText: "Later",
                onConfirm: () => relaunch()
            });
        }
    }

    function applyDefaultConfigCheckAndDo() {
        try {
            let restartNeeded = false;
            let modifiedCount = 0;

            for (const pluginName in Plugins) {
                const plugin = Plugins[pluginName];

                // Les plugins APIs ne peuvent pas être configurés directement
                if (pluginName.endsWith("API")) continue;

                const shouldBeEnabled = Boolean(plugin.required) || Boolean(plugin.enabledByDefault);
                const currentlyEnabled = isPluginEnabled(pluginName);

                if (currentlyEnabled !== shouldBeEnabled) {
                    const pluginSettings = settings.plugins[pluginName];

                    if (plugin.patches?.length) {
                        pluginSettings.enabled = shouldBeEnabled;
                        changes.handleChange(pluginName);
                        restartNeeded = true;
                        modifiedCount++;
                        continue;
                    }

                    if (shouldBeEnabled) {
                        const result = startPlugin(plugin);
                        if (!result) {
                            logger.error(`Error while starting plugin ${pluginName}`);
                            showErrorToast(`Error while starting plugin ${pluginName}`);
                        } else {
                            pluginSettings.enabled = true;
                            modifiedCount++;
                        }
                    } else {
                        const result = stopPlugin(plugin);
                        if (!result) {
                            logger.error(`Error while stopping plugin ${pluginName}`);
                            showErrorToast(`Error while stopping plugin ${pluginName}`);
                        } else {
                            pluginSettings.enabled = false;
                            modifiedCount++;
                        }
                    }
                }
            }

            if (restartNeeded) {
                Alerts.show({
                    title: "Restart Required",
                    body: (
                        <>
                            <p style={{ textAlign: "center" }}>Some plugins require a restart to apply their default configuration.</p>
                            <p style={{ textAlign: "center" }}>Would you like to restart now?</p>
                        </>
                    ),
                    confirmText: "Restart Now",
                    cancelText: "Later",
                    onConfirm: () => relaunch()
                });
            } else {
                Toasts.show({
                    message: `Default config applied. ${modifiedCount} plugin(s) modified.`,
                    type: Toasts.Type.SUCCESS,
                    id: Toasts.genId(),
                    options: { position: Toasts.Position.BOTTOM }
                });
            }
        } catch (err: any) {
            Toasts.show({
                message: `Failed: ${err?.message ?? err}`,
                type: Toasts.Type.FAILURE,
                id: Toasts.genId(),
                options: { position: Toasts.Position.BOTTOM }
            });
            logger.error("Apply Default Config crashed:", err);
        }
    }

    // Code directly taken from supportHelper.tsx
    const { totalStockPlugins, totalUserPlugins, enabledStockPlugins, enabledUserPlugins, enabledPlugins } = useMemo(() => {
        const isApiPlugin = (plugin: string) => plugin.endsWith("API") || Plugins[plugin].required;

        const totalPlugins = Object.keys(Plugins).filter(p => !isApiPlugin(p));
        const enabledPlugins = Object.keys(Plugins).filter(p => isPluginEnabled(p) && !isApiPlugin(p));

        const totalStockPlugins = totalPlugins.filter(p => !PluginMeta[p].userPlugin && !Plugins[p].hidden).length;
        const totalUserPlugins = totalPlugins.filter(p => PluginMeta[p].userPlugin).length;
        const enabledStockPlugins = enabledPlugins.filter(p => !PluginMeta[p].userPlugin).length;
        const enabledUserPlugins = enabledPlugins.filter(p => PluginMeta[p].userPlugin).length;
        return { totalStockPlugins, totalUserPlugins, enabledStockPlugins, enabledUserPlugins, enabledPlugins };
    }, [settings.plugins]);

    // Slice DATA first, then create JSX only for visible items
    const guncordVisibleData = guncordData.slice(0, Math.min(visibleCount, guncordData.length));
    const othersVisibleData = othersData.slice(0, Math.max(0, visibleCount - guncordData.length));

    const makeCard = (p: typeof sortedPlugins[number]) => (
        <ErrorBoundary fallback={<div style={{ color: "red", padding: 8 }}>Failed to render {p.name}.</div>} key={p.name}>
            <PluginCard
                onRestartNeeded={handleRestartNeeded}
                disabled={false}
                plugin={p}
                isNew={newPluginsSet?.has(p.name)}
                hasTutorial={tutorialPlugins.has(p.name)}
            />
        </ErrorBoundary>
    );

    const makeRequiredCard = (p: typeof sortedPlugins[number]) => {
        const tooltipText = p.required || !depMap[p.name]
            ? "This plugin is required for Guncord to function."
            : <PluginDependencyList deps={depMap[p.name]?.filter(d => isPluginEnabled(d))} />;
        return (
            <ErrorBoundary fallback={<div style={{ color: "red", padding: 8 }}>Failed to render {p.name}.</div>} key={p.name}>
                <Tooltip text={tooltipText}>
                    {({ onMouseLeave, onMouseEnter }) => (
                        <PluginCard
                            onMouseLeave={onMouseLeave}
                            onMouseEnter={onMouseEnter}
                            onRestartNeeded={handleRestartNeeded}
                            disabled={true}
                            plugin={p}
                            hasTutorial={tutorialPlugins.has(p.name)}
                        />
                    )}
                </Tooltip>
            </ErrorBoundary>
        );
    };

    const guncordPlugins = guncordVisibleData.map(makeCard);
    const othersVisible = othersVisibleData.map(makeCard);
    const requiredPlugins = requiredData.map(makeRequiredCard);

    const totalGuncordPlugins = React.useMemo(() => {
        return Object.values(Plugins).filter(p => PluginMeta[p.name]?.folderName?.startsWith("src/guncordplugins/")).length;
    }, []);

    const totalOtherPlugins = React.useMemo(() => {
        const isGuncordPlugin = (p: string) => PluginMeta[p]?.folderName?.startsWith("src/guncordplugins/");
        const isCorePlugin = (p: string) => PluginMeta[p]?.folderName?.startsWith("src/plugins/_");
        return Object.values(Plugins).filter(p => !isGuncordPlugin(p.name) && !isCorePlugin(p.name)).length;
    }, []);

    // Category-aware stats for the "ENABLED PLUGINS" card: reflects whichever tab
    // (GUNCORD / OTHERS / all) is currently selected, instead of always being global.
    const categoryStats = useMemo(() => {
        const isApiPlugin = (plugin: string) => plugin.endsWith("API") || Plugins[plugin].required;
        const isGuncordPlugin = (p: string) => PluginMeta[p]?.folderName?.startsWith("src/guncordplugins/");
        const isUserPlugin = (p: string) => PluginMeta[p]?.userPlugin === true;

        let plugins = Object.keys(Plugins).filter(p => !isApiPlugin(p) && !Plugins[p].hidden);

        if (searchValue.status === SearchStatus.GUNCORD) {
            plugins = plugins.filter(isGuncordPlugin);
        } else if (searchValue.status === SearchStatus.OTHERS) {
            plugins = plugins.filter(p => !isGuncordPlugin(p));
        } else if (searchValue.status === SearchStatus.USER_PLUGINS) {
            plugins = plugins.filter(isUserPlugin);
        }

        const total = plugins.length;
        const enabled = plugins.filter(p => isPluginEnabled(p)).length;
        return { total, enabled };
    }, [settings.plugins, searchValue.status]);

    const percent = categoryStats.total > 0 ? Math.round((categoryStats.enabled / categoryStats.total) * 100) : 0;
    const strokeDashoffset = 62.83 - (62.83 * percent / 100);

    return (
        <SettingsTab>
            <div className="vc-plugins-full-width-container">
                {!premiumOnly && (
                    <div className={cl("ecosystem-banner")}>
                        <div className={cl("ecosystem-banner-text")}>
                            <HeadingTertiary>{t("Plugin Management")}</HeadingTertiary>
                            <Paragraph>{t("Manage your Guncord and community plugins here. Enable, disable, and configure them to your liking.")}</Paragraph>
                        </div>
                        <div className={cl("ecosystem-banner-buttons")}>
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={() => openWarningModal(null, undefined, false, enabledPlugins.length, resetCheckAndDo)}
                            >
                                {t("Disable All")}
                            </Button>
                            <Button
                                variant="secondary"
                                size="small"
                                onClick={() => openResetDefaultsModal(applyDefaultConfigCheckAndDo)}
                            >
                                {t("Default Config")}
                            </Button>
                        </div>
                    </div>
                )}

                {!premiumOnly && (
                    <div className={cl("stats-banner")}>
                        <div className={cl("stat-item")}>
                            <div className={cl("stat-title")}>{t("TOTAL PLUGINS")}</div>
                            <div className={cl("stat-value")}>{totalStockPlugins + totalUserPlugins}</div>
                        </div>
                        <div className={cl("stat-item")}>
                            <div className={cl("stat-title")}>{t("ENABLED PLUGINS")}</div>
                            <div className={cl("stat-value")}>
                                {categoryStats.enabled} <span className={cl("stat-percent")}>({percent}%)</span>
                                <div className={cl("stat-chart")}>
                                    <svg width="24" height="24" viewBox="0 0 24 24" style={{ transform: "rotate(-90deg)" }}>
                                        <circle cx="12" cy="12" r="10" fill="transparent" stroke="var(--background-modifier-active)" strokeWidth="4" />
                                        <circle cx="12" cy="12" r="10" fill="transparent" stroke="var(--text-link)" strokeWidth="4" strokeDasharray="62.83" strokeDashoffset={strokeDashoffset} style={{ transition: "stroke-dashoffset 0.5s ease" }} />
                                    </svg>
                                </div>
                            </div>
                        </div>
                        <div
                            className={cl("stat-item")}
                            style={searchValue.status === SearchStatus.USER_PLUGINS ? { cursor: "pointer", transition: "0.2s" } : {}}
                            onClick={() => {
                                if (searchValue.status !== SearchStatus.USER_PLUGINS) return;
                                const native = (window as any).DiscordNative || (window as any).VesktopNative;
                                if (native?.process?.env) {
                                    const home = native.process.env.USERPROFILE || native.process.env.HOME;
                                    if (home) {
                                        const isWindows = !!native.process.env.USERPROFILE;
                                        const folderPath = isWindows ? `${home}\\Documents\\Guncord\\userplugins` : `${home}/Documents/Guncord/userplugins`;
                                        // Open the directory itself (will open its parent and highlight it)
                                        showItemInFolder(folderPath);
                                    }
                                }
                            }}
                            title={searchValue.status === SearchStatus.USER_PLUGINS ? "Click to open folder" : ""}
                        >
                            <div className={cl("stat-title")}>
                                {searchValue.status === SearchStatus.USER_PLUGINS ? t("USER PLUGINS") :
                                 searchValue.status === SearchStatus.OTHERS ? t("VENCORD & EQUICORD PLUGINS") :
                                 t("GUNCORD PLUGINS")}
                            </div>
                            <div className={cl("stat-value")}>
                                {searchValue.status === SearchStatus.USER_PLUGINS ? totalUserPlugins :
                                 searchValue.status === SearchStatus.OTHERS ? totalOtherPlugins :
                                 totalGuncordPlugins}
                            </div>
                        </div>
                    </div>
                )}

                <div className={classes(Margins.bottom20, cl("filter-controls"))}>
                    <ErrorBoundary noop>
                        <TextInput autoFocus value={searchInput} placeholder={t("Find a plugin, tag, or author...")} onChange={onSearch} />
                    </ErrorBoundary>
                    <div className={cl("filter-buttons")} style={{ minWidth: 220 }}>
                        <SafeSearchableSelect
                            options={makeCategoryOptions(totalOtherPlugins)}
                            value={makeCategoryOptions(totalOtherPlugins).find(o => o.value === searchValue.status)?.value ?? SearchStatus.GUNCORD}
                            onChange={(v: any) => {
                                if (v === "community") return;
                                onStatusChange(v);
                            }}
                            closeOnSelect={true}
                            renderOptionPrefix={(o: any) => {
                                if (o?.value === SearchStatus.GUNCORD) return <GuncordTabIcon />;
                                if (o?.value === SearchStatus.OTHERS) return <VencordEquicordTabIcon />;
                                if (o?.value === SearchStatus.USER_PLUGINS) return <UserPluginsTabIcon />;
                                return null;
                            }}
                        />
                    </div>
                </div>

            {premiumOnly ? (
                <>
                    <HeadingTertiary className={Margins.top20}>Premium Plugins</HeadingTertiary>
                    {guncordData.length || othersData.length
                        ? (
                            <div className={cl("grid")}>
                                {[...guncordPlugins, ...othersVisible].length
                                    ? [...guncordPlugins, ...othersVisible]
                                    : <Paragraph>{t("No plugins meet the search criteria.")}</Paragraph>
                                }
                            </div>
                        )
                        : <ExcludedPluginsList search={search} />
                    }
                </>
            ) : (
                <>
                    {guncordData.length > 0 && searchValue.status === SearchStatus.GUNCORD && (
                        <div className={cl("grid")}>
                            {guncordPlugins}
                        </div>
                    )}

                    {othersData.length > 0 && searchValue.status === SearchStatus.OTHERS && (
                        <div className={cl("grid")}>
                            {othersVisible}
                        </div>
                    )}

                    {searchValue.status === SearchStatus.USER_PLUGINS && (
                        <>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12, padding: "8px 0" }}>
                                <UserPluginsTabIcon />
                                <span style={{ color: "var(--header-primary)", fontWeight: 600, fontSize: 14 }}>
                                    {t("User Plugins — from your local folder")}
                                </span>
                            </div>
                            <div style={{
                                background: "rgba(88, 101, 242, 0.08)",
                                border: "1px solid rgba(88, 101, 242, 0.25)",
                                borderRadius: 8,
                                padding: "10px 14px",
                                marginBottom: 16,
                                fontSize: 13,
                                color: "var(--text-normal)",
                                display: "flex",
                                alignItems: "center",
                                gap: 10
                            }}>
                                <span style={{ fontSize: 18 }}>ℹ️</span>
                                <div>
                                    {t("Note: User plugins require installing the client via a local build, not from the website installer.")}
                                </div>
                            </div>
                            {guncordPlugins.length > 0 || othersVisible.length > 0 ? (
                                <div className={cl("grid")}>
                                    {[...guncordPlugins, ...othersVisible]}
                                </div>
                            ) : (
                                <div style={{ textAlign: "center", padding: "48px 16px", color: "var(--text-muted)" }}>
                                    <div style={{ fontSize: 32, marginBottom: 12 }}>📁</div>
                                    <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 8 }}>{t("No user plugins found")}</div>
                                    <div style={{ fontSize: 13 }}>{t("Add .tsx files to your")} <code>Documents/Guncord/userplugins/</code> {t("folder and rebuild with a local build.")}</div>
                                </div>
                            )}
                        </>
                    )}

                    {(searchValue.status !== SearchStatus.GUNCORD && searchValue.status !== SearchStatus.OTHERS && searchValue.status !== SearchStatus.USER_PLUGINS) && (
                        <div className={cl("grid")}>
                            {guncordPlugins}
                            {othersVisible}
                        </div>
                    )}

                    {guncordData.length === 0 && othersData.length === 0 && searchValue.status !== SearchStatus.USER_PLUGINS && (
                        <ExcludedPluginsList search={search} />
                    )}

                    {/* Sentinel: only rendered when there are more items to load */}
                    {hasMore && (
                        <div
                            ref={sentinelRef}
                            style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}
                        >
                            {t("Loading more plugins…")}
                        </div>
                    )}
                </>
            )}

            {!premiumOnly && requiredPlugins.length > 0 && (
                <>
                    <Divider className={Margins.top20} />

                    <HeadingTertiary className={classes(Margins.top20, Margins.bottom8)}>
                        {t("Required Plugins")}
                    </HeadingTertiary>
                    <div className={cl("grid")}>
                        {requiredPlugins.length
                            ? requiredPlugins
                            : <Paragraph>{t("No plugins meet the search criteria.")}</Paragraph>
                        }
                    </div>
                </>
            )}
            </div>
        </SettingsTab>
    );
}

export function PluginDependencyList({ deps }: { deps: string[]; }) {
    return (
        <>
            <Paragraph>{t("This plugin is required by:")}</Paragraph>
            {deps.map((dep: string) => <Paragraph key={dep} className={cl("dep-text")}>{dep}</Paragraph>)}
        </>
    );
}

