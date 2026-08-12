/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Flex } from "@components/Flex";
import { Author, Contributor } from "@guncordplugins/pluginLibrary/types";
import { openURL } from "@guncordplugins/pluginLibrary/utils";
import { findByProps } from "@webpack";
import { Text } from "@webpack/common";
import React from "react";

import { AuthorUserSummaryItem } from "./AuthorSummaryItem";

export interface ContributorAuthorSummaryProps {
    author?: Author;
    contributors?: Contributor[];
}

const openUserProfile = (userId: string) => {
    try {
        const UserProfileModals = findByProps("open", "openUserProfileModal");
        if (UserProfileModals?.open) {
            UserProfileModals.open(userId);
            return;
        }
    } catch (e) {
        console.error("Failed to open profile:", e);
    }

    try {
        const { openUserProfileModal } = findByProps("openUserProfileModal");
        if (openUserProfileModal) {
            openUserProfileModal({ userId });
            return;
        }
    } catch (e) {
        console.error("Failed to open profile modal:", e);
    }

    try {
        if ((window as any).DiscordNative?.userProfile) {
            (window as any).DiscordNative.userProfile.open(userId);
        }
    } catch (e) {
        console.error("Failed to open profile with DiscordNative:", e);
    }
};

export const ContributorAuthorSummary = ({ author, contributors }: ContributorAuthorSummaryProps) => {
    return (
        <Flex style={{ gap: "0.7em" }}>
            {author &&
                <Flex style={{ justifyContent: "center", alignItems: "center", gap: "0.5em" }}>
                    <Text variant="text-sm/normal" style={{ color: "var(--text-muted)" }}>
                        Author: <a
                            onClick={e => {
                                e.preventDefault();

                                if (e.shiftKey && author.github) {
                                    openURL(author.github);
                                } else {

                                    openUserProfile(author.id.toString());
                                }
                            }}
                            style={{ cursor: "pointer" }}
                            title={author.github ? "Click to view Discord profile (Shift+Click for GitHub)" : "Click to view Discord profile"}
                        >{`${author.name}`}</a>
                    </Text>
                    <AuthorUserSummaryItem authors={[author]} />
                </Flex>
            }
            {(contributors && contributors.length > 0) &&
                <Flex style={{ justifyContent: "center", alignItems: "center", gap: "0.5em" }}>
                    <Text variant="text-sm/normal" style={{ color: "var(--text-muted)" }}>
                        Contributors:
                    </Text>
                    <AuthorUserSummaryItem authors={contributors} />
                </Flex>
            }
        </Flex>
    );
};
