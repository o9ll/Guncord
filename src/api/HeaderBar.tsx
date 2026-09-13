/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import ErrorBoundary from "@components/ErrorBoundary";
import { Logger } from "@utils/Logger";
import { classes } from "@utils/misc";
import { findComponentByCodeLazy, findCssClassesLazy } from "@webpack";
import { Clickable, Tooltip, useEffect, useState, Popout, useRef, showToast, Toasts } from "@webpack/common";
import type { ComponentType, JSX, MouseEventHandler, ReactNode } from "react";
import { Settings } from "@api/Settings";
import { showNotification } from "@api/Notifications";

const GUNCORD_LOGO_URI = "data:image/png;base64,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";

const logger = new Logger("HeaderBarAPI");

const HeaderBarClasses = findCssClassesLazy("clickable", "selected", "badge", "badgeContainer");
const HeaderBarIcon = findComponentByCodeLazy(".HEADER_BAR_BADGE_TOP:", '"aria-haspopup":') as ComponentType<ChannelToolbarButtonProps>;

export interface HeaderBarButtonProps {
    /** The icon component to render inside the button */
    icon: ComponentType<any>;
    /** Tooltip text shown on hover. Pass null to disable tooltip */
    tooltip: ReactNode;
    /** Called when the button is clicked */
    onClick?: MouseEventHandler<HTMLDivElement>;
    /** Called when the button is right-clicked */
    onContextMenu?: MouseEventHandler<HTMLDivElement>;
    /** Additional CSS class names */
    className?: string;
    /** Size of the icon in pixels */
    iconSize?: number;
    /** Tooltip position relative to the button */
    position?: "top" | "bottom" | "left" | "right";
    /** Whether the button appears in a selected/active state */
    selected?: boolean;
    /** Aria label for accessibility */
    "aria-label"?: string;
}

export interface ChannelToolbarButtonProps extends HeaderBarButtonProps {
    /** CSS class name for the icon element */
    iconClassName?: string;
    /** Tooltip position relative to the button */
    position?: "top" | "bottom" | "left" | "right";
    /** Whether the button appears in a selected/active state */
    selected?: boolean;
    /** Whether the button is disabled */
    disabled?: boolean;
    /** Whether to show a notification badge */
    showBadge?: boolean;
    /** Position of the notification badge */
    badgePosition?: "top" | "bottom";
}

export type HeaderBarButtonFactory = () => JSX.Element | null;

export interface HeaderBarButtonData {
    /** Function that renders the button component */
    render: HeaderBarButtonFactory;
    /** Icon component used for settings UI display */
    icon: ComponentType<any>;
    /** Higher priority buttons appear further right. Default: 0 */
    priority?: number;
    /** Where to render the button. Default: "headerbar" */
    location?: "headerbar" | "channeltoolbar";
}

interface ButtonEntry {
    render: HeaderBarButtonFactory;
    priority: number;
}

/**
 * Button component for the top header bar (title bar area).
 *
 * @example
 * <HeaderBarButton
 *     icon={MyIcon}
 *     tooltip="My Button"
 *     onClick={() => console.log("clicked")}
 * />
 */
export function HeaderBarButton(props: HeaderBarButtonProps & { ref?: React.RefObject<any>; }) {
    const {
        icon: Icon,
        tooltip,
        onClick,
        onContextMenu,
        className,
        iconSize = 18,
        position = "bottom",
        selected,
        ref,
        "aria-label": ariaLabel,
    } = props;

    const label = ariaLabel ?? (typeof tooltip === "string" ? tooltip : undefined);

    if (!Tooltip || !Clickable || !Icon) {
        return null;
    }

    return (
        <Tooltip text={tooltip ?? ""} position={position} shouldShow={tooltip != null}>
            {({ onMouseEnter, onMouseLeave }) => (
                <Clickable
                    {...{ innerRef: ref } as any}
                    className={classes(HeaderBarClasses.clickable, "guncord-header-btn", className)}
                    style={{ justifyContent: "center", cursor: "pointer" }}
                    onClick={onClick}
                    onContextMenu={onContextMenu}
                    onMouseEnter={onMouseEnter}
                    onMouseLeave={onMouseLeave}
                    role="button"
                    tabIndex={0}
                    aria-label={label}
                    aria-expanded={selected}
                >
                    <Icon width={iconSize} height={iconSize} color="currentColor" />
                </Clickable>
            )}
        </Tooltip>
    );
}

/**
 * Button component for the channel toolbar (below the search bar).
 * Automatically handles selected state styling.
 *
 * @example
 * <ChannelToolbarButton
 *     icon={MyIcon}
 *     tooltip={isOpen ? null : "My Button"}
 *     onClick={() => setOpen(v => !v)}
 *     selected={isOpen}
 * />
 */
export function ChannelToolbarButton(props: ChannelToolbarButtonProps) {
    return <HeaderBarIcon {...props} />;
}

const headerBarButtons = new Map<string, ButtonEntry>();
const channelToolbarButtons = new Map<string, ButtonEntry>();

const headerBarListeners = new Set<() => void>();
const channelToolbarListeners = new Set<() => void>();

/**
 * Adds a button to the header bar (title bar area).
 *
 * @param id - Unique identifier for the button (e.g., "my-plugin-button")
 * @param render - Function that returns the button JSX
 * @param priority - Higher values appear further right. Default: 0
 *
 * @example
 * addHeaderBarButton("my-button", () => (
 *     <HeaderBarButton
 *         icon={MyIcon}
 *         tooltip="My Button"
 *         onClick={handleClick}
 *     />
 * ));
 */
export function addHeaderBarButton(id: string, render: HeaderBarButtonFactory, priority = 0) {
    headerBarButtons.set(id, { render, priority });
    headerBarListeners.forEach(listener => listener());
}

/**
 * Removes a button from the header bar.
 *
 * @param id - The identifier used when adding the button
 */
export function removeHeaderBarButton(id: string) {
    headerBarButtons.delete(id);
    headerBarListeners.forEach(listener => listener());
}

/**
 * Adds a button to the channel toolbar (below the search bar, next to pins/members).
 *
 * @param id - Unique identifier for the button (e.g., "my-plugin-toolbar")
 * @param render - Function that returns the button JSX
 * @param priority - Higher values appear further right. Default: 0
 *
 * @example
 * addChannelToolbarButton("my-toolbar", () => (
 *     <ChannelToolbarButton
 *         icon={MyIcon}
 *         tooltip="My Button"
 *         onClick={handleClick}
 *     />
 * ));
 */
export function addChannelToolbarButton(id: string, render: HeaderBarButtonFactory, priority = 0) {
    channelToolbarButtons.set(id, { render, priority });
    channelToolbarListeners.forEach(listener => listener());
}

/**
 * Removes a button from the channel toolbar.
 *
 * @param id - The identifier used when adding the button
 */
export function removeChannelToolbarButton(id: string) {
    channelToolbarButtons.delete(id);
    channelToolbarListeners.forEach(listener => listener());
}

// ══════════════════════════════════════════════════════════════════
// STEALTH MODE
// ══════════════════════════════════════════════════════════════════

import { isStealthModeEnabled, setStealthActive } from "./stealthState";
export { isStealthModeEnabled };

let _stealthActive = isStealthModeEnabled();

function persistStealth(v: boolean) {
    try { v ? localStorage.setItem("Guncord_stealthMode", "1") : localStorage.removeItem("Guncord_stealthMode"); } catch { }
}

const NON_REACT_SELECTORS = [
    "#guncord-titlebar-btn",
    "#guncord-titlebar-link-style",
    ".nai-nav-item",
];

function hideSettingsSidebarElements(hide: boolean) {
    try {
        // Direct modern Discord settings sidebar targeting
        document.querySelectorAll('li:has([data-settings-sidebar-item*="equicord"]), li:has([data-settings-sidebar-item*="guncord"]), li:has([data-settings-sidebar-item*="illegalcord"]), li:has([data-list-item-id*="settings-sidebar___equicord"]), li:has([data-list-item-id*="settings-sidebar___guncord"]), li:has([data-list-item-id*="settings-sidebar___illegalcord"])').forEach(el => {
            (el as HTMLElement).style.display = hide ? "none" : "";
        });

        document.querySelectorAll('[data-settings-sidebar-item*="equicord"], [data-settings-sidebar-item*="guncord"], [data-settings-sidebar-item*="illegalcord"], [data-list-item-id*="settings-sidebar___equicord"], [data-list-item-id*="settings-sidebar___guncord"], [data-list-item-id*="settings-sidebar___illegalcord"]').forEach(el => {
            (el as HTMLElement).style.display = hide ? "none" : "";
        });

        // Sidebar headers and sections fallback
        const sidebars = document.querySelectorAll("[class*='sidebar_'], [class*='side_'], [role='tablist'], [class*='sectionList_']");
        sidebars.forEach(sidebar => {
            const items = Array.from(sidebar.querySelectorAll("[class*='item_'], [class*='header_'], [class*='separator_'], [class*='sectionLabel_'], [role='tab']"));
            let isGuncordSection = false;
            for (const el of items) {
                const text = el.textContent?.trim()?.toLowerCase() || "";
                const isHeader = el.getAttribute("class")?.includes("header") || el.getAttribute("class")?.includes("sectionLabel") || el.getAttribute("role") === "heading";
                const isSeparator = el.getAttribute("class")?.includes("separator");

                if (text.includes("guncord settings") || text.includes("paramètres de guncord") || text.includes("equicord settings") || text.includes("parametres de guncord")) {
                    isGuncordSection = true;
                    (el as HTMLElement).style.display = hide ? "none" : "";
                    const parentLi = el.closest("li, [class*='section_']");
                    if (parentLi) (parentLi as HTMLElement).style.display = hide ? "none" : "";
                    continue;
                }

                if (isGuncordSection) {
                    if (isHeader) {
                        isGuncordSection = false;
                        continue;
                    }
                    if (isSeparator) {
                        (el as HTMLElement).style.display = hide ? "none" : "";
                        isGuncordSection = false;
                        continue;
                    }
                    (el as HTMLElement).style.display = hide ? "none" : "";
                }
            }
        });
    } catch { }
}

function hideNonReactElements(hide: boolean) {
    for (const sel of NON_REACT_SELECTORS) {
        try {
            document.querySelectorAll(sel).forEach(el => {
                (el as HTMLElement).style.display = hide ? "none" : "";
            });
        } catch { }
    }
    hideSettingsSidebarElements(hide);
}

export function syncStealthBodyClass() {
    try { if (_stealthActive) document.body?.classList.add("guncord-stealth"); else document.body?.classList.remove("guncord-stealth"); } catch { }
    hideNonReactElements(_stealthActive);
}

export function toggleStealthMode() {
    _stealthActive = !_stealthActive;
    setStealthActive(_stealthActive);
    persistStealth(_stealthActive);
    hideNonReactElements(_stealthActive);
    _notifyStealthChange();
    try {
        if (_stealthActive) {
            document.body?.classList.add("guncord-stealth");
            showNotification({
                id: "guncord-stealth-mode",
                title: "Stealth Mode Activated",
                body: "All Guncord visual elements and settings are hidden. Press Ctrl+Shift+H to restore Guncord.",
                icon: "guncord",
                type: "info",
                duration: 6000
            });
        } else {
            document.body?.classList.remove("guncord-stealth");
            showNotification({
                id: "guncord-stealth-mode",
                title: "Stealth Mode Deactivated",
                body: "Guncord visual elements and settings have been restored.",
                icon: "guncord",
                type: "success",
                duration: 4000
            });
        }
    } catch { }
    return _stealthActive;
}

if (_stealthActive) {
    try { hideNonReactElements(true); } catch { }
    try { document.body?.classList.add("guncord-stealth"); } catch { }
}

try {
    document.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.code === "KeyH") {
            e.preventDefault();
            e.stopPropagation();
            toggleStealthMode();
        }
        if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.code === "KeyG") {
            e.preventDefault();
            e.stopPropagation();
            const newVal = !Settings.streamProof;
            Settings.streamProof = newVal;
            if (typeof window !== "undefined" && (window as any).VencordNative?.setContentProtection) {
                (window as any).VencordNative.setContentProtection(newVal);
            }
            try {
                if (newVal) {
                    showNotification({
                        id: "guncord-streamproof-mode",
                        title: "StreamProof Activated",
                        body: "Window content protection is enabled. Press Ctrl+Shift+G to disable.",
                        icon: "guncord",
                        type: "info",
                        duration: 6000
                    });
                } else {
                    showNotification({
                        id: "guncord-streamproof-mode",
                        title: "StreamProof Deactivated",
                        body: "Window content protection is now disabled.",
                        icon: "guncord",
                        type: "success",
                        duration: 4000
                    });
                }
            } catch {}
        }
    }, true);
} catch { }

try {
    let stealthObserver: MutationObserver | null = null;
    let stealthRaf: number | null = null;
    const startObserver = () => {
        if (stealthObserver) return;
        stealthObserver = new MutationObserver(() => {
            if (!_stealthActive) return;
            if (stealthRaf !== null) return;
            stealthRaf = requestAnimationFrame(() => {
                stealthRaf = null;
                if (_stealthActive) hideNonReactElements(true);
            });
        });
        const target = document.body || document.documentElement;
        if (target) {
            stealthObserver.observe(target, { childList: true, subtree: true });
        }
    };
    const stopObserver = () => {
        if (stealthRaf !== null) {
            cancelAnimationFrame(stealthRaf);
            stealthRaf = null;
        }
        if (stealthObserver) { stealthObserver.disconnect(); stealthObserver = null; }
    };
    if (_stealthActive) {
        if (document.body) startObserver();
        else document.addEventListener("DOMContentLoaded", startObserver);
    }
    window.addEventListener("guncord-stealth-change", () => {
        if (_stealthActive) startObserver();
        else stopObserver();
    });
} catch { }

const stealthListeners = new Set<() => void>();
export function _notifyStealthChange() {
    stealthListeners.forEach(fn => fn());
    window.dispatchEvent(new Event("guncord-stealth-change"));
}
export function addStealthListener(fn: () => void) { stealthListeners.add(fn); }
export function removeStealthListener(fn: () => void) { stealthListeners.delete(fn); }

// ══════════════════════════════════════════════════════════════════
// COMPACT MODE
// ══════════════════════════════════════════════════════════════════

let _compactActive = false;
try { _compactActive = localStorage.getItem("Guncord_compactMode") === "1"; } catch { }

export function isCompactModeEnabled(): boolean {
    return _compactActive;
}

function persistCompact(v: boolean) {
    try { v ? localStorage.setItem("Guncord_compactMode", "1") : localStorage.removeItem("Guncord_compactMode"); } catch { }
}

export function syncCompactBodyClass() {
    try {
        const stored = localStorage.getItem("Guncord_compactMode");
        if (stored === "1" && !_compactActive) {
            _compactActive = true;
        } else if (stored !== "1" && _compactActive) {
            _compactActive = false;
        }
    } catch { }

    try {
        if (_compactActive) {
            document.body?.classList.add("guncord-compact");
        } else {
            document.body?.classList.remove("guncord-compact");
        }
    } catch { }

    _notifyCompactChange();
}

export function toggleCompactMode() {
    _compactActive = !_compactActive;
    persistCompact(_compactActive);
    _notifyCompactChange();
    try { if (_compactActive) document.body?.classList.add("guncord-compact"); else document.body?.classList.remove("guncord-compact"); } catch { }
    return _compactActive;
}

if (_compactActive) {
    try { document.body?.classList.add("guncord-compact"); } catch { }
}

export const compactListeners = new Set<() => void>();
export function _notifyCompactChange() {
    compactListeners.forEach(fn => fn());
    window.dispatchEvent(new Event("guncord-compact-change"));
}
export function addCompactListener(fn: () => void) { compactListeners.add(fn); }
export function removeCompactListener(fn: () => void) { compactListeners.delete(fn); }

// ══════════════════════════════════════════════════════════════════
// ICONS
// ══════════════════════════════════════════════════════════════════

const GridVerticalIcon = (props: any) => (
    <svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill={props.color || "currentColor"} {...props}>
        <path d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z" />
    </svg>
);

const GearIcon = (props: any) => (
    <svg width={props.width || 24} height={props.height || 24} viewBox="0 0 24 24" fill={props.color || "currentColor"} {...props}>
        <path fillRule="evenodd" clipRule="evenodd" d="M10.56 1.1c-.46.05-.7.53-.64.98.18 1.16-.19 2.2-.98 2.53-.8.33-1.79-.15-2.49-1.1-.27-.36-.78-.52-1.14-.24-.77.59-1.45 1.27-2.04 2.04-.28.36-.12.87.24 1.14.96.7 1.43 1.7 1.1 2.49-.33.8-1.37 1.16-2.53.98-.45-.07-.93.18-.99.64a11.1 11.1 0 0 0 0 2.88c.06.46.54.7.99.64 1.16-.18 2.2.19 2.53.98.33.8-.14 1.79-1.1 2.49-.36.27-.52.78-.24 1.14.59.77 1.27 1.45 2.04 2.04.36.28.87.12 1.14-.24.7-.95 1.7-1.43 2.49-1.1.8.33 1.16 1.37.98 2.53-.07.45.18.93.64.99a11.1 11.1 0 0 0 2.88 0c.46-.06.7-.54.64-.99-.18-1.16.19-2.2.98-2.53.8-.33 1.79.14 2.49 1.1.27.36.78.52 1.14.24.77-.59 1.45-1.27 2.04-2.04.28-.36.12-.87-.24-1.14-.96-.7-1.43-1.7-1.1-2.49.33-.8 1.37-1.16 2.53-.98.45.07.93-.18.99-.64a11.1 11.1 0 0 0 0-2.88c-.06-.46-.54-.7-.99-.64-1.16.18-2.2-.19-2.53-.98-.33-.8.14-1.79 1.1-2.49.36-.27.52-.78.24-1.14a11.07 11.07 0 0 0-2.04-2.04c-.36-.28-.87-.12-1.14.24-.7.96-1.7 1.43-2.49 1.1-.8-.33-1.16-1.37-.98-2.53.07-.45-.18-.93-.64-.99a11.1 11.1 0 0 0-2.88 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" />
    </svg>
);

// ══════════════════════════════════════════════════════════════════
// COMPACT POPOUTS
// ══════════════════════════════════════════════════════════════════

function CompactHeaderPopout({ type, closePopout }: { type: "header" | "channel", closePopout: () => void; }) {
    const map = type === "header" ? headerBarButtons : channelToolbarButtons;
    return (
        <div className="compact-popout-container">
            <div className="compact-popout-grid">
                {Array.from(map)
                    .sort(([, a], [, b]) => a.priority - b.priority)
                    .map(([id, { render: Button }]) => (
                        <div key={id} style={{ display: "contents" }} onClick={closePopout}>
                            <ErrorBoundary noop>
                                <Button />
                            </ErrorBoundary>
                        </div>
                    ))}
            </div>
            <div className="compact-popout-divider" />
            <div className="compact-popout-disable" onClick={() => { toggleCompactMode(); closePopout(); }}>
                Disable Compact Mode
            </div>
        </div>
    );
}

function CompactSettingsPopout({ closePopout }: { closePopout: () => void; }) {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        compactListeners.add(listener);
        stealthListeners.add(listener);
        window.addEventListener("guncord-compact-change", listener);
        window.addEventListener("guncord-stealth-change", listener);
        return () => {
            compactListeners.delete(listener);
            stealthListeners.delete(listener);
            window.removeEventListener("guncord-compact-change", listener);
            window.removeEventListener("guncord-stealth-change", listener);
        };
    }, []);

    const compact = isCompactModeEnabled();
    const stealth = isStealthModeEnabled();

    return (
        <div className="nc-settings-popout">
            <div className="nc-settings-popout-title">Quick Settings</div>

            <div className="nc-settings-popout-section-label">Appearance</div>

            <div className="nc-settings-popout-row" onClick={() => toggleCompactMode()}>
                <div className="nc-settings-popout-row-info">
                    <div className="nc-settings-popout-row-name">Compact Mode</div>
                    <div className="nc-settings-popout-row-desc">Hide plugin buttons behind a single icon</div>
                </div>
                <div className={`nc-settings-popout-toggle ${compact ? "nc-on" : ""}`} onClick={e => { e.stopPropagation(); toggleCompactMode(); }}>
                    <div className="nc-settings-popout-toggle-knob" />
                </div>
            </div>

            <div className="nc-settings-popout-row" onClick={() => toggleStealthMode()}>
                <div className="nc-settings-popout-row-info">
                    <div className="nc-settings-popout-row-name">Stealth Mode</div>
                    <div className="nc-settings-popout-row-desc">Hide all Guncord UI elements</div>
                </div>
                <div className={`nc-settings-popout-toggle ${stealth ? "nc-on" : ""}`} onClick={e => { e.stopPropagation(); toggleStealthMode(); }}>
                    <div className="nc-settings-popout-toggle-knob" />
                </div>
            </div>

            <div className="nc-settings-popout-divider" />

            <div className="nc-settings-popout-section-label">Plugin Buttons</div>
            <div className="nc-settings-popout-grid">
                {Array.from(headerBarButtons)
                    .sort(([, a], [, b]) => a.priority - b.priority)
                    .map(([id, { render: Button }]) => (
                        <div key={id} style={{ display: "contents" }}>
                            <ErrorBoundary noop>
                                <Button />
                            </ErrorBoundary>
                        </div>
                    ))}
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════════════════════
// TOGGLE COMPONENTS
// ══════════════════════════════════════════════════════════════════

function CompactHeaderBarToggle() {
    const [, forceUpdate] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const popoutRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        compactListeners.add(listener);
        window.addEventListener("guncord-compact-change", listener);
        return () => {
            compactListeners.delete(listener);
            window.removeEventListener("guncord-compact-change", listener);
        };
    }, []);

    return (
        <div style={{ display: "flex", alignItems: "center" }}>
            <Popout
                targetElementRef={popoutRef}
                renderPopout={() => <CompactHeaderPopout type="header" closePopout={() => setIsOpen(false)} />}
                shouldShow={isOpen}
                onRequestClose={() => setIsOpen(false)}
                position="bottom"
                align="right"
                spacing={8}
            >
                {() => (
                    <div ref={popoutRef as any} style={{ display: "flex" }}>
                        <HeaderBarButton
                            icon={GridVerticalIcon}
                            tooltip="Compact Mode"
                            onClick={() => setIsOpen(v => !v)}
                            selected={isOpen}
                        />
                    </div>
                )}
            </Popout>
            <HeaderBarButton
                icon={GearIcon}
                tooltip="Guncord Settings"
                onClick={() => {
                    import("@guncordplugins/compactMode/GuncordModal").then(m => m.openGuncordModal());
                }}
            />
        </div>
    );
}

function CompactChannelToolbarToggle() {
    const [, forceUpdate] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const popoutRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        compactListeners.add(listener);
        window.addEventListener("guncord-compact-change", listener);
        return () => {
            compactListeners.delete(listener);
            window.removeEventListener("guncord-compact-change", listener);
        };
    }, []);

    return (
        <Popout
            targetElementRef={popoutRef}
            renderPopout={() => <CompactHeaderPopout type="channel" closePopout={() => setIsOpen(false)} />}
            shouldShow={isOpen}
            onRequestClose={() => setIsOpen(false)}
            position="bottom"
            align="right"
            spacing={8}
        >
            {() => (
                <div ref={popoutRef as any} style={{ display: "flex" }}>
                    <ChannelToolbarButton
                        icon={GridVerticalIcon}
                        tooltip="Compact Mode"
                        onClick={() => setIsOpen(v => !v)}
                        selected={isOpen}
                    />
                </div>
            )}
        </Popout>
    );
}

// ══════════════════════════════════════════════════════════════════
// MAIN RENDER COMPONENTS
// ══════════════════════════════════════════════════════════════════

function HeaderBarButtons() {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        headerBarListeners.add(listener);
        stealthListeners.add(listener);
        compactListeners.add(listener);
        window.addEventListener("guncord-stealth-change", listener);
        window.addEventListener("guncord-compact-change", listener);
        return () => {
            headerBarListeners.delete(listener);
            stealthListeners.delete(listener);
            compactListeners.delete(listener);
            window.removeEventListener("guncord-stealth-change", listener);
            window.removeEventListener("guncord-compact-change", listener);
        };
    }, []);

    if (isStealthModeEnabled()) return null;

    if (isCompactModeEnabled()) {
        return (
            <div className="vc-header-bar-btns" style={{ display: "contents" }}>
                <CompactHeaderBarToggle />
            </div>
        );
    }

    return (
        <div className="vc-header-bar-btns" style={{ display: "contents" }}>
            <style>{`
                .guncord-header-btn svg,
                .vc-header-bar-btns svg {
                    transform-origin: 50% 50%;
                    will-change: transform;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                }
                .guncord-header-btn:hover svg:not(.nc-multi-instance-icon):not(.nc-soundcord-icon):not(.nc-sway-icon):not(.nc-cleaner-icon):not(.nc-no-anim),
                .vc-header-bar-btns [class*="clickable"]:hover svg:not(.nc-multi-instance-icon):not(.nc-soundcord-icon):not(.nc-sway-icon):not(.nc-cleaner-icon):not(.nc-no-anim),
                .vc-header-bar-btns [class*="iconWrapper"]:hover svg:not(.nc-multi-instance-icon):not(.nc-soundcord-icon):not(.nc-sway-icon):not(.nc-cleaner-icon):not(.nc-no-anim) {
                    animation: nc-header-btn-spring 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) 1;
                }
                @keyframes nc-header-btn-spring {
                    0% {
                        transform: translate3d(0, 0, 0) scale(1);
                    }
                    35% {
                        transform: translate3d(0, 0, 0) scale(1.18);
                    }
                    70% {
                        transform: translate3d(0, 0, 0) scale(0.96);
                    }
                    100% {
                        transform: translate3d(0, 0, 0) scale(1);
                    }
                }

                /* ── Sway Animations (SoundCord, CustomProfile, VoiceSearch, MessageCleaner) ── */
                .nc-sway-icon,
                .nc-soundcord-icon,
                .nc-cleaner-icon {
                    transform-origin: 50% 90%;
                    will-change: transform;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                }

                :hover > .nc-sway-icon,
                [class*="iconWrapper"]:hover .nc-sway-icon,
                [class*="clickable"]:hover .nc-sway-icon,
                .guncord-header-btn:hover .nc-sway-icon,
                button:hover .nc-sway-icon,
                .nc-sway-icon:hover,
                :hover > .nc-soundcord-icon,
                [class*="iconWrapper"]:hover .nc-soundcord-icon,
                [class*="clickable"]:hover .nc-soundcord-icon,
                .guncord-header-btn:hover .nc-soundcord-icon,
                button:hover .nc-soundcord-icon,
                .nc-soundcord-icon:hover,
                :hover > .nc-cleaner-icon,
                [class*="iconWrapper"]:hover .nc-cleaner-icon,
                [class*="clickable"]:hover .nc-cleaner-icon,
                .guncord-header-btn:hover .nc-cleaner-icon,
                button:hover .nc-cleaner-icon,
                .nc-cleaner-icon:hover {
                    animation: nc-soundcord-sway 0.52s cubic-bezier(0.25, 1, 0.5, 1) 1;
                }

                @keyframes nc-soundcord-sway {
                    0% {
                        transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
                    }
                    22% {
                        transform: translate3d(0, 0, 0) rotate(-16deg) scale(1.12);
                    }
                    48% {
                        transform: translate3d(0, 0, 0) rotate(13deg) scale(1.1);
                    }
                    72% {
                        transform: translate3d(0, 0, 0) rotate(-5deg) scale(1.03);
                    }
                    88% {
                        transform: translate3d(0, 0, 0) rotate(2deg) scale(1.01);
                    }
                    100% {
                        transform: translate3d(0, 0, 0) rotate(0deg) scale(1);
                    }
                }

                /* ── MessageCleaner Jumping Trash Lid Animation ── */
                .nc-trash-lid {
                    transform-origin: 50% 25%;
                    will-change: transform;
                    backface-visibility: hidden;
                    -webkit-backface-visibility: hidden;
                }

                :hover > .nc-cleaner-icon .nc-trash-lid,
                [class*="iconWrapper"]:hover .nc-cleaner-icon .nc-trash-lid,
                [class*="clickable"]:hover .nc-cleaner-icon .nc-trash-lid,
                .guncord-header-btn:hover .nc-cleaner-icon .nc-trash-lid,
                button:hover .nc-cleaner-icon .nc-trash-lid,
                .nc-cleaner-icon:hover .nc-trash-lid {
                    animation: nc-trash-lid-jump 0.52s cubic-bezier(0.34, 1.56, 0.64, 1) 1;
                }

                @keyframes nc-trash-lid-jump {
                    0% {
                        transform: translate3d(0, 0, 0) rotate(0deg);
                    }
                    25% {
                        transform: translate3d(1px, -4.5px, 0) rotate(-14deg);
                    }
                    55% {
                        transform: translate3d(-0.5px, -3px, 0) rotate(8deg);
                    }
                    78% {
                        transform: translate3d(0, -1px, 0) rotate(-2deg);
                    }
                    100% {
                        transform: translate3d(0, 0, 0) rotate(0deg);
                    }
                }

            `}</style>
            {Array.from(headerBarButtons)
                .sort(([, a], [, b]) => a.priority - b.priority)
                .map(([id, entry]) => {
                    const Button = entry?.render;
                    if (!Button) return null;
                    return (
                        <ErrorBoundary noop key={id}>
                            <Button />
                        </ErrorBoundary>
                    );
                })}
        </div>
    );
}

function ChannelToolbarButtons() {
    const [, forceUpdate] = useState(0);

    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        channelToolbarListeners.add(listener);
        stealthListeners.add(listener);
        compactListeners.add(listener);
        window.addEventListener("guncord-stealth-change", listener);
        window.addEventListener("guncord-compact-change", listener);
        return () => {
            channelToolbarListeners.delete(listener);
            stealthListeners.delete(listener);
            compactListeners.delete(listener);
            window.removeEventListener("guncord-stealth-change", listener);
            window.removeEventListener("guncord-compact-change", listener);
        };
    }, []);

    if (isStealthModeEnabled()) return null;

    if (isCompactModeEnabled()) {
        return (
            <div className="vc-channel-toolbar-btns" style={{ display: "contents" }}>
                <CompactChannelToolbarToggle />
            </div>
        );
    }

    return (
        <div className="vc-channel-toolbar-btns" style={{ display: "contents" }}>
            {Array.from(channelToolbarButtons)
                .sort(([, a], [, b]) => a.priority - b.priority)
                .map(([id, entry]) => {
                    const Button = entry?.render;
                    if (!Button) return null;
                    return (
                        <ErrorBoundary noop key={id}>
                            <Button />
                        </ErrorBoundary>
                    );
                })}
        </div>
    );
}

const HEADER_STYLE_ID = "guncord-headerbar-style";
const HEADER_STYLE_CSS = `
    div[role="button"][aria-label="Boîte de réception"],
    div[role="button"][aria-label="Inbox"],
    div[role="button"][aria-label="Bandeja de entrada"],
    div[role="button"][aria-label="Posteingang"],
    div[role="button"][aria-label="Входящие"],
    div[role="button"][aria-label*="Inbox" i],
    div[role="button"][aria-label*="réception" i],
    .guncord-header-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        align-self: center !important;
        height: 24px !important;
        min-height: 24px !important;
        max-height: 24px !important;
        width: 24px !important;
        min-width: 24px !important;
        max-width: 24px !important;
        margin: 0 2px !important;
        margin-left: 2px !important;
        margin-right: 2px !important;
        margin-inline: 2px !important;
        padding: 0 !important;
        border-radius: 4px !important;
        box-sizing: border-box !important;
        vertical-align: middle !important;
        line-height: normal !important;
        flex: 0 0 24px !important;
        position: relative !important;
        color: var(--interactive-normal, oklab(0.745437 0.00131872 -0.00849736)) !important;
        transition: background-color 0.15s ease-out, color 0.15s ease-out !important;
    }

    div[role="button"][aria-label="Boîte de réception"]:hover,
    div[role="button"][aria-label="Inbox"]:hover,
    div[role="button"][aria-label="Bandeja de entrada"]:hover,
    div[role="button"][aria-label="Posteingang"]:hover,
    div[role="button"][aria-label="Входящие"]:hover,
    div[role="button"][aria-label*="Inbox" i]:hover,
    div[role="button"][aria-label*="réception" i]:hover,
    .guncord-header-btn:hover {
        background-color: var(--background-modifier-hover, rgba(78, 80, 88, 0.3)) !important;
        color: var(--interactive-hover, oklab(0.89908 -0.00192902 -0.01033)) !important;
    }

    div[role="button"][aria-label="Boîte de réception"] svg,
    div[role="button"][aria-label="Inbox"] svg,
    div[role="button"][aria-label="Bandeja de entrada"] svg,
    div[role="button"][aria-label="Posteingang"] svg,
    div[role="button"][aria-label="Входящие"] svg,
    div[role="button"][aria-label*="Inbox" i] svg,
    div[role="button"][aria-label*="réception" i] svg,
    .guncord-header-btn svg {
        width: 18px !important;
        height: 18px !important;
        min-width: 18px !important;
        min-height: 18px !important;
        max-width: 18px !important;
        max-height: 18px !important;
        display: block !important;
        margin: auto !important;
        flex-shrink: 0 !important;
    }
`;

function ensureHeaderStyles() {
    if (typeof document === "undefined") return;
    if (!document.getElementById(HEADER_STYLE_ID)) {
        const style = document.createElement("style");
        style.id = HEADER_STYLE_ID;
        style.textContent = HEADER_STYLE_CSS;
        document.head.appendChild(style);
    }
}
try { ensureHeaderStyles(); } catch {}

/** @internal Injected by HeaderBarAPI patch (do NOT call directly) */
export function _addHeaderBarButtons() {
    ensureHeaderStyles();
    return [
        <HeaderBarButtons key="vc-header-bar-buttons" />
    ];
}

/** @internal Injected by HeaderBarAPI patch (do NOT call directly) */
export function _addChannelToolbarButtons(children: any[]) {
    ensureHeaderStyles();
    children.push(<ChannelToolbarButtons key="vc-channel-toolbar-buttons" />);
}
