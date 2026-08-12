/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { openScreenshareModal } from "@guncordplugins/betterScreenshare.desktop/modals";
import { Button } from "@webpack/common";
import React from "react";

export interface OpenScreenshareSettingsButtonProps {
    title?: string;
}

export const OpenScreenshareSettingsButton = (props: OpenScreenshareSettingsButtonProps) => {
    return (
        <Button
            size={Button.Sizes.SMALL}
            color={Button.Colors.PRIMARY}
            onClick={openScreenshareModal}
        >
            {props.title ? props.title : "Screenshare Settings"}
        </Button>
    );
};
