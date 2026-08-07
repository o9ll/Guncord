/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export let initialQuestDataFetched = false;
let settingsModalOpen = false;

export function setInitialQuestDataFetched(fetched: boolean): void {
    initialQuestDataFetched = fetched;
}

export function setSettingsModalOpen(open: boolean): void {
    settingsModalOpen = open;
}

export function getSettingsModalOpen(): boolean {
    return settingsModalOpen;
}
