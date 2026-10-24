/**
 * @author Avesd
 * @package UI Controls
 * @namespace Test
 * @description DOM environment for component interaction tests without layout emulation
 */

import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
    pretendToBeVisual: true,
});
const { window } = dom;
const browserGlobals = [
    "window",
    "document",
    "navigator",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLFormElement",
    "HTMLSelectElement",
    "HTMLButtonElement",
    "Element",
    "Node",
    "NodeFilter",
    "Document",
    "DocumentFragment",
    "ShadowRoot",
    "MutationObserver",
    "Event",
    "CustomEvent",
    "MouseEvent",
    "PointerEvent",
    "KeyboardEvent",
    "FocusEvent",
    "FormData",
    "DOMRect",
    "getComputedStyle",
    "requestAnimationFrame",
    "cancelAnimationFrame",
] as const;
for (const name of browserGlobals) {
    const value = name === "window" ? window : window[name];
    Object.defineProperty(globalThis, name, {
        configurable: true,
        writable: true,
        value,
    });
}
Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
    configurable: true,
    writable: true,
    value: true,
});
Object.defineProperty(window, "matchMedia", {
    value: (media: string): MediaQueryList => {

        return {
            media,
            matches: false,
            onchange: null,
            addListener() {},
            removeListener() {},
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent: () => {

                return true;
            },
        };
    },
});
// jsdom has no layout or scrolling. Geometry is verified in the real renderer.
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value() {},
});

// jsdom cannot capture pointers; the native Electron suite covers pointer behavior.
Object.defineProperty(window.HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value() {

        return false;
    },
});
