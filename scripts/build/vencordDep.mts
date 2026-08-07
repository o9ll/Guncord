/*
 * Guncord, a Discord client mod
 * Copyright (c) 2026 o9
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { globalExternalsWithRegExp } from "@fal-works/esbuild-plugin-global-externals";

const names: Record<string, string> = {
    webpack: "Vencord.Webpack",
    "webpack/common": "Vencord.Webpack.Common",
    utils: "Vencord.Util",
    api: "Vencord.Api",
    "api/settings": "Vencord",
    components: "Vencord.Components"
};

export default globalExternalsWithRegExp({
    getModuleInfo(modulePath) {
        const path = modulePath.replace(/@Guncord\/types\/|@guncord\/types\//i, "");
        let varName = names[path] as string | undefined;
        if (!varName) {
            const altMapping = names[path.split("/")[0]] as string | undefined;
            if (!altMapping) throw new Error("Unknown module path: " + modulePath);

            varName =
                altMapping +
                "." +
                // @ts-ignore
                path.split("/")[1].replaceAll("/", ".");
        }
        return {
            varName,
            type: "cjs"
        };
    },
    modulePathFilter: /^@[Gg]uncord\/types.+$/
});

