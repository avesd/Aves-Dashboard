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

/** Lease identity and deduplicated requests share the lifetime of their native owner. */
export class BlockLeases {
    readonly entries = new Map<string, BlockLease>();
    readonly requests = new Map<string, {
        fingerprint: string;
        operation: Promise<BlockActionResult>;
    }>();
    readonly #owners = new Set<WebContents>();

    watch(owner: WebContents): void {

        if (!this.#owners.has(owner)) {
            this.#owners.add(owner);
            owner.once("destroyed", () => {

                this.#owners.delete(owner);
                for (const [
                    leaseId,
                    entry,
                ] of this.entries) {
                    if (entry.owner === owner) {
                        this.entries.delete(leaseId);
                        for (const key of this.requests.keys()) {
                            if (key.startsWith(`${leaseId}/`)) {
                                this.requests.delete(key);
                            }
                        }
                    }
                }
            });
        }
    }
    notify(canvasId?: string, dynamicOnly = false): void {

        for (const owner of new Set([...this.entries.values()].filter(lease => {

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

        this.entries.delete(id);
        for (const key of this.requests.keys()) {
            if (key.startsWith(`${id}/`)) {
                this.requests.delete(key);
            }
        }
    }
    dispose(): void {

        this.entries.clear();
        this.requests.clear();
        this.#owners.clear();
    }
}
