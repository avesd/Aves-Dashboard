/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_IPC
 * @description Dispatch Command
 */

import type { CommandHandlers } from "@avesd/desktop-contracts/ipc-commands";

/** The discriminant selects a handler validated by CommandHandlers at its declaration. */
export function dispatchCommand<R extends {
    type: string;
}, Results extends Record<R["type"], unknown>>(request: R, handlers: CommandHandlers<R, Results>): Results[R["type"]] | Promise<Results[R["type"]]> {

    const handler = handlers[request.type as R["type"]];

    // TypeScript cannot preserve the correlation of a union with a mapped function lookup.
    return (handler as (input: R) => Results[R["type"]] | Promise<Results[R["type"]]>)(request);
}
