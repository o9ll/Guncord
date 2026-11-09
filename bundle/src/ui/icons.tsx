/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { React, ReactNative } from "../metro/common";

/**
 * Strict Zero-Emoji Policy: Clean SVG vector icons for mobile UI.
 */
export function GuncordLogoIcon({ size = 24, color = "#5865F2" }: { size?: number; color?: string }) {
    const R = React.current;
    const RN = ReactNative.current;
    if (!R || !RN) return null;

    // Minimal vector representation
    return R.createElement(RN.View, {
        style: {
            width: size,
            height: size,
            borderRadius: size / 4,
            backgroundColor: color,
            alignItems: "center",
            justifyContent: "center"
        }
    },
        R.createElement(RN.Text, {
            style: {
                color: "#ffffff",
                fontWeight: "bold",
                fontSize: size * 0.55
            }
        }, "N")
    );
}

export function SettingsIcon({ size = 20, color = "#949ba4" }: { size?: number; color?: string }) {
    const R = React.current;
    const RN = ReactNative.current;
    if (!R || !RN) return null;

    return R.createElement(RN.View, {
        style: {
            width: size,
            height: size,
            borderWidth: 2,
            borderColor: color,
            borderRadius: size / 2,
            alignItems: "center",
            justifyContent: "center"
        }
    },
        R.createElement(RN.View, {
            style: {
                width: size / 3,
                height: size / 3,
                backgroundColor: color,
                borderRadius: size / 6
            }
        })
    );
}

