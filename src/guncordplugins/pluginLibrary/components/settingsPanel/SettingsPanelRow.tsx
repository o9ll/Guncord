/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { panelClasses } from "@guncordplugins/pluginLibrary/discordModules";
import { classes } from "@utils/misc";
import React from "react";

export interface SettingsPanelRowProps {
    children: React.ComponentProps<"div">["children"];
}

export const SettingsPanelRow = ({ children }: SettingsPanelRowProps) => {
    return (
        <div
            className={classes(panelClasses.actionButtons)}
            style={{ padding: 0 }}
        >
            {children}
        </div>
    );
};
