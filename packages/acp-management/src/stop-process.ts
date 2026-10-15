/**
 * @author Avesd
 * @package ACP Management
 * @namespace Root
 * @description Confirm adapter exit before releasing its scratch directory
 */

import type { ChildProcess } from "node:child_process";

export async function stopAcpProcess(child: ChildProcess): Promise<void> {

    if (child.exitCode !== null || child.signalCode !== null || child.pid === undefined) {
        return;
    }
    await new Promise<void>(resolve => {

        const timer = setTimeout(() => {

            child.kill("SIGKILL");
        }, 1500);
        child.once("exit", () => {

            clearTimeout(timer); resolve();
        });
        child.kill("SIGTERM");
    });
}
