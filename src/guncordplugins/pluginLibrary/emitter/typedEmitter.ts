/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import type EventEmitter from "events";

export type TypedEmitter<Events extends Record<string, (...args: any[]) => any>> = EventEmitter & {
    /** Phantom marker so `J extends TypedEmitter<infer N>` can recover the events map. */
    __events?: Events;
    on<E extends keyof Events>(event: E, listener: Events[E]): TypedEmitter<Events>;
    once<E extends keyof Events>(event: E, listener: Events[E]): TypedEmitter<Events>;
    off<E extends keyof Events>(event: E, listener: Events[E]): TypedEmitter<Events>;
    addListener<E extends keyof Events>(event: E, listener: Events[E]): TypedEmitter<Events>;
    removeListener<E extends keyof Events>(event: E, listener: Events[E]): TypedEmitter<Events>;
    emit<E extends keyof Events>(event: E, ...args: Parameters<Events[E]>): boolean;
};
