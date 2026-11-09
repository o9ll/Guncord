/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { Heading } from "@components/Heading";
import { SettingsTab, wrapTab } from "@components/settings";
import { TooltipContainer } from "@components/TooltipContainer";
import { ensureIconsLoaded, iconsModule, onIconsLoaded } from "@plugins/_core/concatenatedModules";
import { debounce } from "@shared/debounce";
import { Margins } from "@utils/margins";
import { classes } from "@utils/misc";
import { useIntersection } from "@utils/react";
import { Clickable, TextInput, useCallback, useEffect, useMemo, useState } from "@webpack/common";

import { IconsDef } from "../types";
import { openIconModal } from "./Modals";

let cachedIcons: IconsDef | null = null;

function filterIcons(raw: IconsDef): IconsDef {
    if (!raw || typeof raw !== "object") return {};
    return Object.fromEntries(
        Object.entries(raw).filter(([name, fn]) =>
            typeof fn === "function" && name.endsWith("Icon")
        )
    );
}

function getIcons(): IconsDef {
    if (cachedIcons && Object.keys(cachedIcons).length > 0) return cachedIcons;

    if (iconsModule && typeof iconsModule === "object") {
        const filtered = filterIcons(iconsModule);
        if (Object.keys(filtered).length > 0) {
            cachedIcons = filtered;
            return cachedIcons;
        }
    }

    return {};
}

function searchMatch(search: string, name: string, Icon: any, searchByFunction: boolean): boolean {
    if (!search) return true;

    if (searchByFunction) return String(Icon).includes(search);

    const words = name.replace(/([A-Z]([a-z]+)?)/g, " $1").toLowerCase().split(" ");
    const keywords = search.toLowerCase().split(" ");
    return keywords.every(k => words.includes(k)) ||
        words.every(w => keywords.includes(w)) ||
        name.toLowerCase().includes(search.toLowerCase());
}

function IconItem({ iconName, Icon }: { iconName: string; Icon: any; }) {
    const fill = iconName === "CircleShieldIcon" ? "var(--background-base-low)" : "var(--interactive-icon-default)";

    return (
        <div className="vc-icon-box">
            <Clickable onClick={() => openIconModal(iconName, Icon)}>
                <div className="vc-icon-container">
                    <Icon className="vc-icon-icon" size="lg" width={32} height={32} color="var(--interactive-icon-default)" fill={fill} />
                </div>
            </Clickable>
            <Heading className="vc-icon-title" tag="h3">{iconName}</Heading>
        </div>
    );
}

function IconsTab() {
    const [icons, setIcons] = useState<IconsDef>(() => getIcons());
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [searchByFunction, setSearchByFunction] = useState(false);

    useEffect(() => {
        ensureIconsLoaded();
        return onIconsLoaded(newIcons => {
            const filtered = filterIcons(newIcons);
            cachedIcons = filtered;
            setIcons(filtered);
        });
    }, []);

    const debouncedSetSearch = useMemo(
        () => debounce((query: string) => setSearch(query), 150),
        []
    );

    const onSearch = useCallback((query: string) => {
        setSearchInput(query);
        debouncedSetSearch(query);
    }, [debouncedSetSearch]);

    const filteredIcons = useMemo(() =>
        Object.entries(icons).filter(([name, Icon]) => searchMatch(search, name, Icon, searchByFunction)),
        [icons, search, searchByFunction]
    );

    const iconsToLoad = 120;
    const [visibleCount, setVisibleCount] = useState(iconsToLoad);

    useEffect(() => {
        setVisibleCount(iconsToLoad);
    }, [search, searchByFunction]);

    const loadMore = useCallback(() => {
        setVisibleCount(v => Math.min(v + iconsToLoad, filteredIcons.length));
    }, [filteredIcons.length]);

    const [sentinelRef, isSentinelVisible] = useIntersection();

    useEffect(() => {
        if (isSentinelVisible && visibleCount < filteredIcons.length) {
            loadMore();
        }
    }, [isSentinelVisible, visibleCount, filteredIcons.length, loadMore]);

    const visibleIcons = filteredIcons.slice(0, visibleCount);
    const iconCount = Object.keys(icons).length;

    return (
        <SettingsTab>
            <div className={classes(Margins.top16, "vc-icon-tab-search-bar-grid")}>
                <TextInput
                    autoFocus
                    value={searchInput}
                    placeholder={iconCount > 0 ? `Search ${iconCount} icons...` : "Loading icons..."}
                    onChange={onSearch}
                />
                <TooltipContainer text="Search by function context">
                    <Button
                        size="small"
                        aria-label="Search by function context"
                        className="vc-icon-search-func-btn"
                        variant={searchByFunction ? "positive" : "primary"}
                        onClick={() => setSearchByFunction(!searchByFunction)}
                    >
                        Func
                    </Button>
                </TooltipContainer>
            </div>
            <div className="vc-icons-tab-grid-container">
                {visibleIcons.map(([iconName, Icon]) => (
                    <IconItem key={iconName} iconName={iconName} Icon={Icon} />
                ))}
            </div>
            {visibleCount < filteredIcons.length && (
                <div ref={sentinelRef} className="vc-icon-sentinel" />
            )}
        </SettingsTab>
    );
}

export default wrapTab(IconsTab, "IconsTab");
