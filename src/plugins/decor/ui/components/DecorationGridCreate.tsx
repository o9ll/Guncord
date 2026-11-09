/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { PlusIcon } from "@components/Icons";
import { Paragraph } from "@components/Paragraph";
import { getIntlMessage } from "@utils/discord";
import { HTMLProps } from "react";

import { DecorationGridItem } from ".";

type DecorationGridCreateProps = HTMLProps<HTMLDivElement> & {
    onSelect: () => void;
};

export default function DecorationGridCreate(props: DecorationGridCreateProps) {
    return <DecorationGridItem
        {...props}
        isSelected={false}
    >
        <PlusIcon />
        <Paragraph
            size="xs"
            color="text-strong"
        >
            {getIntlMessage("CREATE")}
        </Paragraph>
    </DecorationGridItem >;
}
