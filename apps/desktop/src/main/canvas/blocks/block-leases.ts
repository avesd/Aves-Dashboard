/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Canvas_Blocks
 * @description Block Leases
 */

import type { BlockActionResult } from "../../../shared/canvas/blocks";
import { dashboardBlocksChannels } from "../../../shared/canvas/blocks";
import type { BlockLease } from "./block-runtime-types";
import type { WebContents } from "electron";

interface BlockRequest {
    readonly fingerprint: string;
    readonly operation: Promise<BlockActionResult>;
}

/** Lease identity and deduplicated requests share the lifetime of their native owner. */
export class BlockLeases {
    readonly #entries = new Map<string, BlockLease>();
    readonly #requests = new Map<string, BlockRequest>();
    readonly #owners = new Set<WebContents>();

    register(lease: BlockLease): void {

        this.#entries.set(lease.id, lease);
        this.#watch(lease.owner);
    }
    get(id: string): BlockLease | undefined {

        return this.#entries.get(id);
    }
    has(id: string): boolean {

        return this.#entries.has(id);
    }
    values(): IterableIterator<BlockLease> {

        return this.#entries.values();
    }
    get requestCount(): number {

        return this.#requests.size;
    }
    getRequest(leaseId: string, requestId: string): BlockRequest | undefined {

        return this.#requests.get(`${leaseId}/${requestId}`);
    }
    registerRequest(leaseId: string, requestId: string, request: BlockRequest): void {

        // Admission can resume after an asynchronous read has outlived its lease.
        if (this.#entries.has(leaseId)) {
            this.#requests.set(`${leaseId}/${requestId}`, request);
        }
    }
    #watch(owner: WebContents): void {

        if (!this.#owners.has(owner)) {
            this.#owners.add(owner);
            owner.once("destroyed", () => {

                this.#owners.delete(owner);
                this.releaseOwner(owner);
            });
        }
    }
    notify(canvasId?: string, dynamicOnly = false): void {

        for (const owner of new Set([...this.#entries.values()].filter(lease => {

            return (!canvasId || lease.canvasId === canvasId) && (!dynamicOnly || lease.dynamic);
        }).map(lease => {

            return lease.owner;
        }))) {
            if (!owner.isDestroyed()) {
                owner.send(dashboardBlocksChannels.changed);
            }
        }
    }
    release(id: string): void {

        this.#entries.delete(id);
        for (const key of this.#requests.keys()) {
            if (key.startsWith(`${id}/`)) {
                this.#requests.delete(key);
            }
        }
    }
    releaseOwner(owner: WebContents): void {

        for (const lease of this.#entries.values()) {
            if (lease.owner === owner) {
                this.release(lease.id);
            }
        }
    }
    dispose(): void {

        this.#entries.clear();
        this.#requests.clear();
        this.#owners.clear();
    }
}
