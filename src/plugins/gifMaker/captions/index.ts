/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type { CaptionDefinition } from "../types";
import { captionCaption } from "./caption";
import { noneCaption } from "./none";
import { speechbubbleCaption } from "./speechbubble";

export const CAPTIONS: CaptionDefinition[] = [
    noneCaption,
    captionCaption,
    speechbubbleCaption,
];
