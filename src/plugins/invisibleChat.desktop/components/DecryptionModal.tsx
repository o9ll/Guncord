/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Heading } from "@components/Heading";
import { RenderModalProps } from "@vencord/discord-types";
import { Modal, openModal, React, TextInput } from "@webpack/common";

import { buildEmbed, decrypt } from "../index";

export function DecModal(props: RenderModalProps & { message: any; }) {
    const encryptedMessage: string = props?.message?.content;
    const [password, setPassword] = React.useState("password");

    const onDecrypt = () => {
        const toSend = decrypt(encryptedMessage, password, true);
        if (!toSend || !props?.message) return;
        buildEmbed(props?.message, toSend);
        props.onClose();
    };

    return (
        <Modal
            {...props}
            size="sm"
            title="Decrypt Message"
            actions={[
                {
                    text: "Decrypt",
                    variant: "primary",
                    onClick: onDecrypt
                },
                {
                    text: "Cancel",
                    variant: "secondary",
                    onClick: props.onClose
                }
            ]}
        >
            <Heading style={{ marginTop: "10px" }}>Message with Encryption</Heading>
            <TextInput defaultValue={encryptedMessage} disabled={true}></TextInput>
            <Heading style={{ marginTop: "10px" }}>Password</Heading>
            <TextInput
                style={{ marginBottom: "20px" }}
                onChange={setPassword}
            />
        </Modal>
    );
}

export function buildDecModal(msg: any): any {
    openModal((props: any) => <DecModal {...props} {...msg} />);
}
