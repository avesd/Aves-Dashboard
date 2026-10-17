/**
 * @author Avesd
 * @package Renderer Canvas
 * @namespace Blocks
 * @description Mounted Block
 */

import type { BlockMount } from "@avesd/desktop-contracts/canvas/blocks";
import type { DashboardBlock } from "@avesd/workspace-model";

export interface MountedBlock {
    readonly block: DashboardBlock;
    readonly mount: BlockMount;
    status: "loading" | "ready" | "error";
    timeout?: ReturnType<typeof setTimeout>;
}
