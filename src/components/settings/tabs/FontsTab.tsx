/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { t } from "@api/i18n";
import { Card } from "@components/Card";
import { FormSwitch } from "@components/FormSwitch";
import { SettingsTab } from "@components/settings/tabs/BaseTab";
import {
    GLOBAL_FONTS,
    getGlobalFontConfig,
    setGlobalFontConfig,
    subscribeGlobalFont,
    type GlobalFontConfig
} from "customization/globalFonts/globalFontManager";
import { Button, React, Select, showToast, TextInput, Toasts, useEffect, useMemo, useState } from "@webpack/common";

const ResetIcon = () => (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
    </svg>
);

export function FontsContent() {
    const [config, setConfig] = useState<GlobalFontConfig>(getGlobalFontConfig);
    const [selectedFontId, setSelectedFontId] = useState<string>(() => {
        const cur = getGlobalFontConfig();
        return cur.fontId && cur.fontId !== "none" ? cur.fontId : "poppins";
    });
    const [customInput, setCustomInput] = useState(config.customFamily || "");

    useEffect(() => {
        const cur = getGlobalFontConfig();
        setConfig(cur);
        if (cur.fontId && cur.fontId !== "none") {
            setSelectedFontId(cur.fontId);
        }
        const unsub = subscribeGlobalFont(next => {
            setConfig(next);
            if (next.fontId && next.fontId !== "none") {
                setSelectedFontId(next.fontId);
            }
        });
        return unsub;
    }, []);

    const update = (patch: Partial<GlobalFontConfig>) => {
        const next = setGlobalFontConfig(patch);
        setConfig(next);
        showToast(t("Client font updated successfully"), Toasts.Type.SUCCESS);
    };

    const handleSelectFont = (fontId: string) => {
        setSelectedFontId(fontId);
        if (config.enabled) {
            update({
                fontId,
                customFamily: fontId === "custom" ? customInput : config.customFamily,
                enabled: true
            });
        }
    };

    const handleToggleEnabled = (enabled: boolean) => {
        if (enabled) {
            update({
                fontId: selectedFontId,
                customFamily: selectedFontId === "custom" ? customInput : config.customFamily,
                enabled: true
            });
        } else {
            update({ enabled: false });
        }
    };

    const handleCustomSubmit = () => {
        if (!customInput.trim()) return;
        update({ fontId: "custom", customFamily: customInput.trim(), enabled: true });
    };

    const handleReset = () => {
        update({ fontId: "none", customFamily: "", scale: 1.0, enabled: false });
        setSelectedFontId("poppins");
        setCustomInput("");
    };

    const isCustomActive = Boolean(config.enabled && config.fontId !== "none");
    const activeDef = GLOBAL_FONTS[config.fontId] || GLOBAL_FONTS.none;
    const previewDef = GLOBAL_FONTS[selectedFontId] || GLOBAL_FONTS.poppins;

    const fontOptions = useMemo(() => {
        return Object.values(GLOBAL_FONTS).map(font => ({
            label: t(font.name),
            value: font.id,
        }));
    }, []);

    const previewFontFamily = selectedFontId === "custom" && customInput.trim()
        ? customInput.trim()
        : previewDef.fontFamily || "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

    return (
        <div className="nc-fonts-tab">
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Header Description */}
                <div>
                    <h2 style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: "var(--header-primary, #ffffff)",
                        margin: "0 0 6px 0"
                    }}>
                        {t("Client Typography & Fonts")}
                    </h2>
                    <p style={{
                        fontSize: 14,
                        color: "var(--text-muted, #949ba4)",
                        margin: 0,
                        lineHeight: 1.45
                    }}>
                        {t("Customize the typography across your entire Discord client. Change the font for all settings, interface, messages, profiles, and dialogs.")}
                    </p>
                </div>

                {/* Status and Active Info Card */}
                <Card style={{
                    background: "var(--background-secondary, #2b2d31)",
                    border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
                    borderRadius: 8,
                    padding: "16px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16
                }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--header-primary, #ffffff)" }}>
                                {t("Active Client Font")}
                            </span>
                            <span style={{
                                fontSize: 12,
                                fontWeight: 600,
                                padding: "2px 8px",
                                borderRadius: 12,
                                background: isCustomActive ? "var(--brand-500, #5865f2)" : "var(--background-tertiary, #1e1f22)",
                                color: "#ffffff"
                            }}>
                                {isCustomActive
                                    ? (config.fontId === "custom" && config.customFamily ? config.customFamily : t(activeDef.name))
                                    : t("Default (Discord)")}
                            </span>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--text-muted, #949ba4)" }}>
                            {isCustomActive
                                ? t("Custom typography applied to entire client interface and messages.")
                                : t("Default Discord typography is currently active.")}
                        </div>
                    </div>

                    {isCustomActive && (
                        <Button
                            size={Button.Sizes.SMALL}
                            color={Button.Colors.PRIMARY}
                            onClick={handleReset}
                            style={{ display: "flex", alignItems: "center" }}
                        >
                            <ResetIcon />
                            {t("Reset to Default")}
                        </Button>
                    )}
                </Card>

                {/* Font Selector & Configuration Card */}
                <Card style={{
                    background: "var(--background-secondary, #2b2d31)",
                    border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))",
                    borderRadius: 8,
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 18
                }}>
                    {/* Font Dropdown (Case de défilement sélective) */}
                    <div>
                        <div style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--header-primary, #ffffff)",
                            marginBottom: 8
                        }}>
                            {t("Select Font")}
                        </div>
                        <Select
                            options={fontOptions}
                            placeholder={t("Choose a font...")}
                            closeOnSelect={true}
                            select={handleSelectFont}
                            isSelected={(v: string) => v === selectedFontId}
                            serialize={(v: string) => v}
                        />
                        <div style={{ fontSize: 12, color: "var(--text-muted, #949ba4)", marginTop: 6 }}>
                            {t(previewDef.description)}
                        </div>
                    </div>

                    {/* Custom Font Family Input (if Custom Font is selected) */}
                    {selectedFontId === "custom" && (
                        <div style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            padding: "14px",
                            backgroundColor: "var(--background-tertiary, #1e1f22)",
                            borderRadius: 6
                        }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--header-primary, #ffffff)" }}>
                                {t("Custom Font Family")}
                            </div>
                            <div style={{ display: "flex", gap: 10 }}>
                                <TextInput
                                    value={customInput}
                                    placeholder={t("e.g. Segoe UI, Consolas, Roboto, Impact, Arial")}
                                    onChange={setCustomInput}
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    size={Button.Sizes.SMALL}
                                    color={Button.Colors.BRAND}
                                    onClick={handleCustomSubmit}
                                    disabled={!customInput.trim()}
                                >
                                    {t("Apply")}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Live Font Sample Preview */}
                    <div>
                        <div style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "var(--text-muted, #949ba4)",
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: 6
                        }}>
                            {t("Live Font Preview")}
                        </div>
                        <div
                            className={`nc-font-sample nc-font-sample-${selectedFontId}`}
                            style={{
                                padding: "14px 16px",
                                background: "var(--background-tertiary, #1e1f22)",
                                borderRadius: 6,
                                border: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.06))",
                                fontFamily: previewFontFamily,
                                fontSize: previewDef.previewFontSize ?? (selectedFontId === "pixel" ? 12 : 16),
                                fontWeight: previewDef.fontWeight ?? undefined,
                                letterSpacing: previewDef.letterSpacing ?? undefined,
                                color: "var(--header-primary, #ffffff)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis"
                            }}
                        >
                            Guncord Discord Client 2026
                        </div>
                    </div>

                    {/* Toggle Button / Switch directly underneath (OFF by default) */}
                    <div style={{
                        paddingTop: 12,
                        borderTop: "1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))"
                    }}>
                        <FormSwitch
                            value={isCustomActive}
                            onChange={handleToggleEnabled}
                            title={t("Enable Custom Font")}
                            description={t("Apply the selected font across all Discord channels, dialogs, and messages.")}
                            hideBorder
                        />
                    </div>
                </Card>
            </div>
        </div>
    );
}

export default function FontsTab() {
    return (
        <SettingsTab>
            <FontsContent />
        </SettingsTab>
    );
}

