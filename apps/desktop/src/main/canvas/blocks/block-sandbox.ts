/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Canvas_Blocks
 * @description Block Sandbox
 */

import { CANVAS_DOCUMENT_CSP, canvasDocument } from "../canvas-document";
import type { WebContents } from "electron";
import { protocol } from "electron";

interface CanvasSandbox {
    readonly owner: WebContents;
    readonly canvasId: string;
}

/** Native sandbox documents and URL ownership share a single protocol lifetime. */
export class BlockSandboxes {
    readonly #entries = new Map<string, CanvasSandbox>();
    constructor() {

        protocol.handle("aves-block", request => {

            const id = new URL(request.url).pathname.slice(1);
            const lease = this.#entries.get(id);
            if (!lease || lease.owner.isDestroyed()) {
                return new Response("Block is unavailable.", { status: 404 });
            }

            return new Response(canvasDocument(), {
                headers: {
                    "content-type": "text/html; charset=utf-8",
                    "content-security-policy": CANVAS_DOCUMENT_CSP,
                    "cache-control": "no-store",
                },
            });
        });
    }
    get(id: string): CanvasSandbox | undefined {

        return this.#entries.get(id);
    }
    values() {

        return this.#entries.values();
    }
    set(id: string, sandbox: CanvasSandbox): void {

        this.#entries.set(id, sandbox);
    }
    delete(id: string): void {

        this.#entries.delete(id);
    }
    allowedURL(owner: WebContents, address: string): boolean {

        try {
            const url = new URL(address);
            const lease = this.#entries.get(url.pathname.slice(1));

            return url.protocol === "aves-block:" && url.hostname === "render" && !!lease && lease.owner === owner;
        } catch {
            return false;
        }
    }
    dispose(): void {

        this.#entries.clear();
        protocol.unhandle("aves-block");
    }
}
