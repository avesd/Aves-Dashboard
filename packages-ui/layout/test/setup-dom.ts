/**
 * @author Avesd
 * @package UI Layout
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

        const mediaQueryList = {
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

        return mediaQueryList;
    },
});
// jsdom has no layout or scrolling. Geometry is verified in the real renderer.
Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value() {},
});

const resizeCallbacks = new Set<ResizeObserverCallback>();
Object.defineProperty(globalThis, "ResizeObserver", {
    value: class implements ResizeObserver {
        constructor(private readonly callback: ResizeObserverCallback) {}
        observe(): void {

            resizeCallbacks.add(this.callback);
        }
        unobserve(): void {

            resizeCallbacks.delete(this.callback);
        }
        disconnect(): void {

            resizeCallbacks.delete(this.callback);
        }
    },
});

export function resizeContainer(width: number): void {

    for (const callback of resizeCallbacks) {
        // Only the contentRect width is consumed; native geometry is covered by Electron tests.
        callback([{ contentRect: { width } } as ResizeObserverEntry], {} as ResizeObserver);
    }
}
