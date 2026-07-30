/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

const NITRO_UPSELL_ACTIONS = [
    "PREMIUM_GUILD_SUBSCRIPTION_MODAL_SHOW",
    "GUILD_SUBSCRIPTION_POPOUT_SHOW",
    "NITRO_GIFT_CODE_RESOLVED",
    "PREMIUM_GIFT_CODE_MODAL_SHOW",
    "SHOW_PREMIUM_UPSELL_MODAL",
    "PREMIUM_UPSELL_MODAL_SHOW",
    "GUILD_ROLE_SUBSCRIPTION_PURCHASE_MODAL_SHOW",
    "PREMIUM_TRIAL_OFFER_MODAL_SHOW",
];

export default definePlugin({
    name: "NoNitroUpsell",
    description: "Automatically blocks Nitro upsell/gift popups that Discord keeps showing.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    enabledByDefault: true,

    flux: Object.fromEntries(
        NITRO_UPSELL_ACTIONS.map(action => [
            action,
            () => false
        ])
    ),
});

