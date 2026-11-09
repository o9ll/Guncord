/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import React from "react";

const handleClick = async () =>
    console.log((await import("@utils/clipboard")).copyToClipboard("\u200b"));

export const Example: React.FC<{
    real: boolean,
    shigged?: number,
}> = ({ real, shigged }) => <>
    <p>{`Shigg${real ? `ies${shigged === 0x1B ? "t" : ""}` : "y"}`}</p>
    <button onClick={handleClick}>Click Me</button>
</>;
