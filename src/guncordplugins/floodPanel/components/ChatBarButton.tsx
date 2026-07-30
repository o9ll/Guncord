/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { ChatBarButton, ChatBarButtonFactory } from "@api/ChatButtons";
import { openModal } from "@utils/modal";
import { useState } from "@webpack/common";

import { FloodModal } from "./FloodModal";
import { FloodIcon } from "./Icons";
import { t } from "../../autoTranslateGuncord";

export const FloodPanelButton: ChatBarButtonFactory = ({ isMainChat, channel }) => {
    const [isRunning, setIsRunning] = useState(false);

    if (!isMainChat) return null;

    function handleClick() {
        openModal(props => (
            <FloodModal
                channel={channel}
                rootProps={props}
                onRunningChange={setIsRunning}
            />
        ));
    }

    return (
        <ChatBarButton
            tooltip={isRunning ? t("Flood in progress...") : t("Flood Panel")}
            onClick={handleClick}
            buttonProps={{ "aria-haspopup": "dialog" }}
        >
            <FloodIcon color={isRunning ? "var(--status-danger)" : undefined} />
        </ChatBarButton>
    );
};

