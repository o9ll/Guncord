/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { findByProps, findByStoreName } from "./index";

let _React: any;
export const React = {
    get current() {
        return (_React ??= findByProps("createElement", "useState", "useEffect"));
    }
};

let _ReactNative: any;
export const ReactNative = {
    get current() {
        return (_ReactNative ??= findByProps("View", "Text", "StyleSheet"));
    }
};

let _FluxDispatcher: any;
export const FluxDispatcher = {
    get current() {
        return (_FluxDispatcher ??= findByProps("_dispatch", "dispatch", "subscribe")?.default ?? findByProps("_dispatch", "dispatch"));
    }
};

let _ThemeStore: any;
export const ThemeStore = {
    get current() {
        return (_ThemeStore ??= findByStoreName("ThemeStore"));
    }
};

let _UserStore: any;
export const UserStore = {
    get current() {
        return (_UserStore ??= findByStoreName("UserStore"));
    }
};

let _Navigation: any;
export const Navigation = {
    get current() {
        return (_Navigation ??= findByProps("push", "navigate", "pop"));
    }
};

let _Toast: any;
export const Toast = {
    get current() {
        return (_Toast ??= findByProps("showToast", "openToast") ?? findByProps("show", "hide"));
    }
};

let _Alert: any;
export const Alert = {
    get current() {
        return (_Alert ??= findByProps("openModal", "openModalLazy") ?? ReactNative.current?.Alert);
    }
};

