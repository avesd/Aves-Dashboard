/**
 * @author Avesd
 * @package Desktop
 * @namespace Build
 * @description Compile browser-only sandbox entries for inline documents
 */

import { stripTypeScriptTypes } from "node:module";

/** Entries are self-contained IIFEs; type queries are erased and no static value imports are allowed. */
export function sandboxSource(source) {

    return stripTypeScriptTypes(source, { mode: "transform" }).replace(/<\/script/giu, "<\\/script");
}
