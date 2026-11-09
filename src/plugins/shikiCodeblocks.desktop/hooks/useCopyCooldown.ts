/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { copyToClipboard } from "@utils/clipboard";
import { useState } from "@webpack/common";

export function useCopyCooldown(cooldown: number) {
    const [copyCooldown, setCopyCooldown] = useState(false);

    function copy(text: string) {
        copyToClipboard(text);
        setCopyCooldown(true);

        setTimeout(() => {
            setCopyCooldown(false);
        }, cooldown);
    }

    return [copyCooldown, copy] as const;
}
