/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./start";

import { spawn } from "child_process";
spawn("bun", ["run", "scripts/build/build.mts", "--watch", "--dev"], { stdio: "inherit" });
