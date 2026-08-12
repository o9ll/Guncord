/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Button } from "@components/Button";
import { panelClasses } from "@guncordplugins/pluginLibrary";
import { classes } from "@utils/misc";
import React, { JSX } from "react";

export type IconComponent = <T extends { className: string; }>(props: T) => JSX.Element;
export interface SettingsPanelButtonProps extends Partial<React.ComponentProps<typeof Button>> {
    icon?: IconComponent;
}

export const SettingsPanelButton = (props: SettingsPanelButtonProps) => {
    return (
        <Button
            size="small"
            className={classes(panelClasses.button, panelClasses.buttonColor)}
            {...props}
        >
            {props.icon && <props.icon className={classes(panelClasses.buttonIcon)} />}
        </Button>
    );
};
