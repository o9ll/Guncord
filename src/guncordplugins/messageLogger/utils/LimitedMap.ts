/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/*
 * Guncord, a modification for Discord's desktop app
 * Copyright (c) 2026 o9
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { settings } from "../index";

export class LimitedMap<K, V> {
    public map: Map<K, V> = new Map();
    constructor() { }

    set(key: K, value: V) {
        const limit = ((settings?.store as any)?.cacheLimit > 0) ? (settings.store as any).cacheLimit : 1000; if (this.map.size >= limit) { const firstKey = this.map.keys().next().value; if (firstKey !== undefined) this.map.delete(firstKey); }
        this.map.set(key, value);
    }

    get(key: K) {
        return this.map.get(key);
    }

    clear() {
        this.map.clear();
    }
}
