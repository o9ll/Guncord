/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { closeModal, ModalCloseButton as RawClose, ModalContent as RawContent, ModalFooter as RawFooter, ModalHeader as RawHeader, ModalRoot as RawRoot, openModal } from "@utils/modal";
import type { ComponentType, PropsWithChildren } from "react";

export type { ModalProps, RenderModalProps } from "@vencord/discord-types";
export { closeModal, openModal };

type ModalComponent = ComponentType<PropsWithChildren<Record<string, unknown>>>;

export const ModalRoot = RawRoot as ModalComponent;
export const ModalHeader = RawHeader as ModalComponent;
export const ModalContent = RawContent as ModalComponent;
export const ModalFooter = RawFooter as ModalComponent;
export const ModalCloseButton = RawClose as ModalComponent;
