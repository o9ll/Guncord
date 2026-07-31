/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import ErrorBoundary from "@components/ErrorBoundary";
import definePlugin from "@utils/types";

import { hasSeenTutorial, resetTutorialSeen } from "./storage";
import { closeTutorial, openTutorial } from "./TutorialModal";
import TutorialSettings from "./TutorialSettings";

let tutorialTimeout: number | undefined;

const SafeTutorialSettings = ErrorBoundary.wrap(TutorialSettings, { noop: true });

async function openFirstRunTutorial() {
    if (await hasSeenTutorial()) return;

    openTutorial();
}

export default definePlugin({
    name: "GuncordTutorial",
    description: "Shows a first-run guided tutorial for Guncord features.",
    authors: [{ name: ".zp", id: 1020801845490356245n }],
    settingsAboutComponent: SafeTutorialSettings,
    toolboxActions: {
        "Open Guncord tutorial": openTutorial,
        "Show Guncord tutorial next startup": resetTutorialSeen
    },

    start() {
        tutorialTimeout = window.setTimeout(() => {
            void openFirstRunTutorial().catch(() => undefined);
        }, 1500);
    },

    stop() {
        if (tutorialTimeout !== undefined) {
            clearTimeout(tutorialTimeout);
            tutorialTimeout = undefined;
        }

        closeTutorial();
    }
});
