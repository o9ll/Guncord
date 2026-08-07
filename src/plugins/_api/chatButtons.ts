/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "ChatInputButtonAPI",
    description: "API to add buttons to the chat input",
    authors: [Devs.Ven],

    patches: [
        {
            find: '"sticker")',
            all: false,
            replacement: {
                match: /0===(\i)\.length(?=.{0,25}?\(0,\i\.jsxs?\)\(.{0,75}?children:\1)(?!,\(Vencord\.Api\.ChatButtons)/,
                replace: "(Vencord.Api.ChatButtons._injectButtons($1,arguments[0]),$&)"
            }
        }
    ]
});
