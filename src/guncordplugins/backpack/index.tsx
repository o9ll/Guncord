/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./styles.css";

import { BackpackedButtons, ChatBarButton, ChatBarButtonFactory, ChatBarButtonMap, ChatBarProps, notifyBackpackChange } from "@api/ChatButtons";
import { DataStore } from "@api/index";
import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";
import { ContextMenuApi,Menu, Popout, React, Tooltip, useEffect, useRef, useState } from "@webpack/common";

const STORE_KEY = "Backpack_packedButtons";

// ─── Persistence ──────────────────────────────────────────────────────────────

async function loadPacked(): Promise<string[]> {
    try { return (await DataStore.get<string[]>(STORE_KEY)) ?? []; }
    catch { return []; }
}

async function savePacked(ids: string[]) {
    try { await DataStore.set(STORE_KEY, ids); } catch { }
}

async function packButton(id: string) {
    BackpackedButtons.add(id);
    notifyBackpackChange();
    await savePacked([...BackpackedButtons]);
}

async function unpackButton(id: string) {
    BackpackedButtons.delete(id);
    notifyBackpackChange();
    await savePacked([...BackpackedButtons]);
}

// ─── SVG Icons (Chevron Up = closed, Chevron Down = open) ──────────────────

function ChevronUpIcon(props: Record<string, any>) {
    const { width = 20, height = 20, ...rest } = props;
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <path fill="currentColor" d="M3.3 15.7a1 1 0 0 0 1.4 0L12 8.42l7.3 7.3a1 1 0 0 0 1.4-1.42l-8-8a1 1 0 0 0-1.4 0l-8 8a1 1 0 0 0 0 1.42Z" />
        </svg>
    );
}

function ChevronDownIcon(props: Record<string, any>) {
    const { width = 20, height = 20, ...rest } = props;
    return (
        <svg width={width} height={height} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
            <path fill="currentColor" d="M5.3 9.3a1 1 0 0 1 1.4 0l5.3 5.29 5.3-5.3a1 1 0 1 1 1.4 1.42l-6 6a1 1 0 0 1-1.4 0l-6-6a1 1 0 0 1 0-1.42Z" />
        </svg>
    );
}

// ─── Backpack Popout (left-click) ────────────────────────────────────────────
// Renders the actual components of the packed buttons — they work just like in the bar

const backpackListeners = (require("@api/ChatButtons") as any).backpackListeners as Set<() => void>;

function useBackpack() {
    const [, forceUpdate] = useState(0);
    useEffect(() => {
        const listener = () => forceUpdate(n => n + 1);
        backpackListeners.add(listener);
        return () => { backpackListeners.delete(listener); };
    }, []);
    return {
        packed: Array.from(BackpackedButtons),
        available: Array.from(ChatBarButtonMap.keys()).filter(id => id !== "Backpack" && !BackpackedButtons.has(id))
    };
}

function BackpackPopout({ chatBarProps, closePopout }: { chatBarProps: ChatBarProps; closePopout: () => void; }) {
    const { packed: packedIds } = useBackpack();
    const packed = packedIds
        .filter(id => ChatBarButtonMap.has(id))
        .map(id => ({ id, data: ChatBarButtonMap.get(id)! }));

    const popoutContainerRef = useRef<HTMLDivElement>(null);

    if (packed.length === 0) {
        return (
            <div className="backpack-popout-horizontal-empty">
                Right-click to pack plugins
            </div>
        );
    }

    return (
        <div className="backpack-popout-horizontal" ref={popoutContainerRef} style={{ overflow: "visible" }}>
            {packed.map(({ id, data }) => (
                <Tooltip text={id} key={id}>
                    {(tooltipProps: any) => (
                        <div
                            className="backpack-item-horizontal"
                            {...tooltipProps}
                            style={{ overflow: "visible" }}
                            onClick={e => {
                                // Disable auto-close to allow toggling multiple plugins
                                // closePopout();
                            }}
                        >
                            <ErrorBoundary noop>
                                <data.render
                                    {...chatBarProps}
                                    isMainChat={true}
                                    isAnyChat={true}
                                    popoutContainer={popoutContainerRef.current}
                                />
                            </ErrorBoundary>
                        </div>
                    )}
                </Tooltip>
            ))}
        </div>
    );
}

// ─── Context Menu (right-click) ────────────────────────────────────────────────

function BackpackContextMenu() {
    const { available, packed } = useBackpack();

    return (
        <Menu.Menu navId="backpack-context" onClose={ContextMenuApi.closeContextMenu}>
            <Menu.MenuGroup label="Pack Plugins into Backpack">
                {Array.from(ChatBarButtonMap.keys())
                    .filter(id => id !== "Backpack")
                    .sort()
                    .map(id => {
                        const data = ChatBarButtonMap.get(id);
                        const isPacked = BackpackedButtons.has(id);
                        return (
                            <Menu.MenuCheckboxItem
                                key={`bp-toggle-${id}`}
                                id={`bp-toggle-${id}`}
                                label={id}
                                checked={isPacked}
                                action={() => isPacked ? unpackButton(id) : packButton(id)}
                            />
                        );
                    })}
            </Menu.MenuGroup>
        </Menu.Menu>
    );
}

// ─── Chat Bar Button ──────────────────────────────────────────────────────────

const BackpackChatBarButton: ChatBarButtonFactory = props => {
    const { isMainChat, ...chatBarProps } = props;
    const [isOpen, setIsOpen] = useState(false);
    const [count, setCount] = useState(BackpackedButtons.size);
    const popoutRef = useRef<HTMLDivElement>(null);
    // Count number of popups/modals open above the backpack
    const overlayCount = useRef(0);

    // Observe everything that appears in Discord's DOM layer
    // Discord renders its modals/popups in special containers outside the popout
    useEffect(() => {
        if (!isOpen) {
            overlayCount.current = 0;
            return;
        }

        // Snapshot of body children when backpack opens
        // Any new child appearing afterwards = portal/popup = block closing
        const bodyChildrenAtOpen = new Set(Array.from(document.body.children));

        function looksLikeOverlay(node: HTMLElement): boolean {
            // Case 1: direct new child of body (Discord portal)
            if (!bodyChildrenAtOpen.has(node)) return true;
            // Case 2: class name contains known layer/modal pattern
            const cls = node.className?.toString() ?? "";
            return ["layerContainer", "focusLock", "backdrop", "modal"].some(p => cls.includes(p));
        }

        // Observe direct children of document.body (where Discord inserts its portals)
        const observer = new MutationObserver(mutations => {
            for (const m of mutations) {
                for (const node of Array.from(m.addedNodes)) {
                    if (node instanceof HTMLElement && looksLikeOverlay(node)) {
                        overlayCount.current++;
                    }
                }
                for (const node of Array.from(m.removedNodes)) {
                    if (node instanceof HTMLElement && looksLikeOverlay(node)) {
                        overlayCount.current = Math.max(0, overlayCount.current - 1);
                    }
                }
            }
        });

        // body : enfants directs seulement (les portals Discord sont toujours au top level)
        observer.observe(document.body, { childList: true, subtree: false });

        return () => {
            observer.disconnect();
            overlayCount.current = 0;
        };
    }, [isOpen]);

    useEffect(() => {
        const listener = () => {
            const actualCount = Array.from(BackpackedButtons).filter(id => ChatBarButtonMap.has(id)).length;
            setCount(actualCount);
        };
        const bl = (require("@api/ChatButtons") as any).backpackListeners as Set<() => void>;
        bl.add(listener);
        // Initial call to set correct count on mount
        listener();
        return () => { bl.delete(listener); };
    }, []);

    if (!isMainChat) return null;

    return (
        <Popout
            targetElementRef={popoutRef}
            renderPopout={() => <BackpackPopout chatBarProps={chatBarProps as any as ChatBarProps} closePopout={() => setIsOpen(false)} />}
            shouldShow={isOpen}
            onRequestClose={() => {
                    // Ne ferme pas si un popup/modal est ouvert par un plugin du backpack
                    if (overlayCount.current > 0) return;
                    setIsOpen(false);
                }}
            position="top"
            align="right"
            spacing={8}
        >
            {(_, { isShown }) => (
                <ChatBarButton
                    tooltip={`Backpack${count > 0 ? ` (${count})` : ""}`}
                    onClick={() => setIsOpen(v => !v)}
                    onContextMenu={(e: React.MouseEvent) => {
                        e.preventDefault();
                        ContextMenuApi.openContextMenu(e, (props: any) => (
                            <ErrorBoundary noop>
                                <BackpackContextMenu {...props} />
                            </ErrorBoundary>
                        ));
                    }}
                >
                    <div ref={popoutRef as any} style={{ position: "relative", display: "flex", alignItems: "center" }}>
                        {isOpen ? <ChevronDownIcon /> : <ChevronUpIcon />}
                        {count > 0 && <div className="backpack-badge">{count}</div>}
                    </div>
                </ChatBarButton>
            )}
        </Popout>
    );
};

async function isExistingUser(): Promise<boolean> {
    try {
        if (await DataStore.get<boolean>("Guncord_installed")) return true;
        if ((await DataStore.get<any>("Vencord_existingPlugins")) !== undefined) return true;
        if ((await DataStore.get<any>("TokenImporter_accounts")) !== undefined) return true;
        if ((await DataStore.get<any>("SaveProfile_presets")) !== undefined) return true;
        if ((await DataStore.get<any>("Vencord_cloudSecret")) !== undefined) return true;
    } catch { }
    return false;
}

// ─── Plugin Definition ────────────────────────────────────────────────────────

export default definePlugin({
    name: "Backpack",
    enabledByDefault: true,
    description: "Organize chat bar buttons into a backpack. Left-click to use packed buttons, right-click to pack/unpack buttons.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    dependencies: ["ChatInputButtonAPI"],

    chatBarButton: {
        icon: ChevronUpIcon,
        render: BackpackChatBarButton,
    },

    async start() {
        // Check if we have saved data (null = first install/update, [] = manually emptied)
        const rawPacked = await DataStore.get<string[] | null>(STORE_KEY);

        if (rawPacked === null || rawPacked === undefined) {
            const existingUser = await isExistingUser();
            if (existingUser) {
                // Existing user updating Guncord: keep buttons unpacked
                await savePacked([]);
                await DataStore.set("Guncord_installed", true);
            } else {
                // Fresh install: pack chat bar buttons except Backpack itself
                await new Promise(r => setTimeout(r, 500));
                const allIds = Array.from(ChatBarButtonMap.keys()).filter(id => id !== "Backpack");
                for (const id of allIds) BackpackedButtons.add(id);
                await savePacked([...BackpackedButtons]);
                await DataStore.set("Guncord_installed", true);
            }
        } else {
            for (const id of rawPacked) BackpackedButtons.add(id);
            await DataStore.set("Guncord_installed", true);
        }
        notifyBackpackChange();
    },

    stop() {
        BackpackedButtons.clear();
        notifyBackpackChange();
    },
});
