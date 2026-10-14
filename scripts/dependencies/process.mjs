/**
 * @author Avesd
 * @package Scripts
 * @namespace Scripts_Dependencies
 * @description Process
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export const run = (command, args, options = {}) => {

    const result = spawnSync(command, args, {
        cwd: repositoryRoot,
        stdio: "inherit",
        ...options,
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(" ")} failed (${result.status ?? result.signal})`);
    }

    return result;
};
