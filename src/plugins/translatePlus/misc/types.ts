/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { classNameFactory } from "@utils/css";

export const cl = classNameFactory("eq-trans-");

export interface Translation {
    text: string;
    src: string;
}

export type IconProps = {
    width?: number;
    height?: number;
};
