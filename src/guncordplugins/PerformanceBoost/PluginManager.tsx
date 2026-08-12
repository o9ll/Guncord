/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button, TextButton } from "@components/Button";
import { Paragraph } from "@components/Paragraph";
import { Switch } from "@components/Switch";
import { Margins } from "@utils/margins";
import { relaunch } from "@utils/native";
import { RenderModalProps } from "@vencord/discord-types";
import { Alerts, Modal, openModal, TextInput, useMemo, useState } from "@webpack/common";

import { enabledTogglablePlugins, enterPerformanceMode, exitPerformanceMode, parseKeep } from "./pluginToggle";
import { settings } from "./settings";

function promptRestart() {
    Alerts.show({
        title: "Restart Required",
        body: <Paragraph>{"Discord must restart to apply the plugin changes."}</Paragraph>,
        confirmText: "Restart Now",
        cancelText: "Later",
        onConfirm: () => relaunch(),
    });
}

export function handleGameModeChange(value: boolean) {
    if (value) {
        if (!settings.store.pluginSaved) {
            settings.store.pluginSaved = JSON.stringify(enterPerformanceMode(parseKeep(settings.store.pluginKeep)));
            promptRestart();
        }
    } else if (settings.store.pluginSaved) {
        let saved: string[] = [];
        try { saved = JSON.parse(settings.store.pluginSaved || "[]"); } catch { /* Ignore */ }
        exitPerformanceMode(saved);
        settings.store.pluginSaved = "";
        promptRestart();
    }
}

function userEnabledPlugins(): string[] {
    const set = new Set(enabledTogglablePlugins());
    if (settings.store.pluginSaved) {
        try { for (const n of JSON.parse(settings.store.pluginSaved || "[]")) set.add(n); } catch { /* Ignore */ }
    }
    return [...set].sort((a, b) => a.localeCompare(b));
}

function ExceptionsModal({ modalProps }: { modalProps: RenderModalProps; }) {
    const [query, setQuery] = useState("");
    const [keep, setKeep] = useState<Set<string>>(() => new Set(parseKeep(settings.store.pluginKeep)));

    const enabled = useMemo(userEnabledPlugins, []);

    const persist = (next: Set<string>) => {
        setKeep(new Set(next));
        settings.store.pluginKeep = [...next].join(",");
    };
    const toggle = (name: string) => {
        const next = new Set(keep);
        if (next.has(name)) next.delete(name); else next.add(name);
        persist(next);
    };
    const keepAll = () => persist(new Set(enabled));
    const clearAll = () => persist(new Set());

    const q = query.toLowerCase();
    const shown = enabled.filter(n => n.toLowerCase().includes(q));

    const keptCount = enabled.filter(n => keep.has(n)).length;
    const disableCount = enabled.length - keptCount;

    return (
        <Modal
            {...modalProps}
            title={"Performance Mode Exceptions"}
            subtitle={"Your enabled plugins. Keep the ones you want on; the rest are turned off temporarily and restored later."}
            actions={[{ text: "Done", variant: "primary", onClick: modalProps.onClose }]}
        >
            {enabled.length === 0 ? (
                <Paragraph style={{ padding: "24px 12px", textAlign: "center" }}>
                    {"No optional plugins are enabled."}
                </Paragraph>
            ) : (
                <>
                    <TextInput
                        className={Margins.bottom8}
                        placeholder={"Search a plugin…"}
                        value={query}
                        onChange={setQuery}
                    />
                    <div className="vc-perfboost-pm-toolbar">
                        <span className="vc-perfboost-pm-summary">
                            <span><b>{keptCount}</b> {"kept"}</span>
                            <span><b>{disableCount}</b> {"off"}</span>
                        </span>
                        <span className="vc-perfboost-pm-actions">
                            <TextButton variant="primary" onClick={keepAll}>{"Keep all"}</TextButton>
                            <TextButton variant="secondary" onClick={clearAll}>{"Clear"}</TextButton>
                        </span>
                    </div>
                    <div className="vc-perfboost-pm-list">
                        {shown.map(name => (
                            <div key={name} className="vc-perfboost-pm-row">
                                <span className="vc-perfboost-pm-name" onClick={() => toggle(name)}>{name}</span>
                                <Switch checked={keep.has(name)} onChange={() => toggle(name)} />
                            </div>
                        ))}
                        {shown.length === 0 && (
                            <Paragraph style={{ padding: 12, textAlign: "center" }}>{"No results"}</Paragraph>
                        )}
                    </div>
                </>
            )}
        </Modal>
    );
}

export function PluginManagerControls() {
    const { pluginKeep } = settings.use(["pluginKeep"]);
    const keepCount = parseKeep(pluginKeep).length;

    return (
        <div className="vc-perfboost-pm-controls">
            <Paragraph className="vc-perfboost-pm-hint">
                {
                    "When performance mode is enabled above, other plugins (except essentials and your exceptions) are temporarily disabled with a restart prompt, and restored when it's turned off."
                }
            </Paragraph>
            <Button
                variant="secondary"
                size="small"
                onClick={() => openModal(modalProps => <ExceptionsModal modalProps={modalProps} />)}
            >
                {`Exceptions (${keepCount})`}
            </Button>
        </div>
    );
}
