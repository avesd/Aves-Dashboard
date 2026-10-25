/**
 * @author Avesd
 * @package Desktop
 * @namespace Build
 * @description Inline checked browser sandbox source in host documents
 */

import { sandboxSource } from "./sandbox-source.mjs";
import { readFile } from "node:fs/promises";

export function sandboxPlugin() {

    return {
        name: "avesd-sandbox-source",
        async load(id) {

            if (!id.endsWith("?sandbox")) {
                return;
            }
            const path = id.slice(0, -"?sandbox".length);
            this.addWatchFile(path);
            const source = sandboxSource(await readFile(path, "utf8"));

            return `export default ${JSON.stringify(source)};`;
        },
    };
}
