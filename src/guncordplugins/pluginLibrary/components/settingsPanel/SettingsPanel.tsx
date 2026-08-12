/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { panelClasses } from "@guncordplugins/pluginLibrary/discordModules";
import { React } from "@webpack/common";

export interface SettingsPanelProps {
    children: React.ComponentProps<"div">["children"];
}

export const SettingsPanel = ({ children }: SettingsPanelProps) => {
    return (
        <div
            className={panelClasses.container}>
            {children}
        </div>
    );
};
