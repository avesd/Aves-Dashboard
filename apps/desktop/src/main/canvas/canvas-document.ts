/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Canvas
 * @description Canvas Document
 */

import runtime from "../../sandbox/canvas-runtime.ts?sandbox";

export const CANVAS_DOCUMENT_CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; sandbox allow-scripts allow-forms";

export function canvasDocument(): string {

    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;overflow:clip;background:transparent}body{cursor:grab;touch-action:none}body:active{cursor:grabbing}#world{position:absolute;inset:0;pointer-events:none;transform-origin:0 0}.block{position:absolute;left:0;top:0;pointer-events:auto;cursor:auto;isolation:isolate;contain:layout style;overflow:clip}</style></head><body><div id="world"></div><script>${runtime}</script></body></html>`;
}
