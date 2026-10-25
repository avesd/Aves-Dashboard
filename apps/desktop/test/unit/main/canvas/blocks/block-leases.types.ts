/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_Unit_Main_Canvas_Blocks
 * @description Lease registry encapsulation contract
 */

import type { BlockLeases } from "../../../../../src/main/canvas/blocks/block-leases";

/** Compile-only checks; registry storage must not expose structural mutation. */
export function checkLeaseRegistryTypes(registry: BlockLeases): void {

    // @ts-expect-error Lease registration must include owner-lifetime bookkeeping.
    registry.entries.clear();
    // @ts-expect-error Request retention belongs to the registry's lease lifecycle.
    registry.requests.clear();
    const leases = registry.values();
    // @ts-expect-error Iteration does not expose a mutable map.
    leases.clear();
}
