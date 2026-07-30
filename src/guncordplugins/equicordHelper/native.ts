/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { CspPolicies, CSPSrc } from "@main/csp";

// Allow all domains to have the permissions from CSPSrc
CspPolicies["*"] = CSPSrc;

