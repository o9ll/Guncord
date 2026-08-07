/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@Guncord/types/components";

import { SettingsComponent } from "./Settings";

export const ArRPCSettingsButton: SettingsComponent = () => {
    return <Button onClick={() => VesktopNative.arrpc.openSettings()}>Configure Rich Presence</Button>;
};

