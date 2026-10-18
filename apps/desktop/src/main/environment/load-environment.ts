/**
 * @author Avesd
 * @package Desktop
 * @namespace Main_Environment
 * @description Load Environment
 */

import { parse } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const keys = ["DEEPSEEK_MODEL"] as const;
/** Load only server-owned settings. Never pass secrets to Vite or renderer definitions. */
export function loadEnvironment(directory: string, stage: "development" | "production", target: NodeJS.ProcessEnv = process.env): void {

    const values: Record<string, string> = {};
    for (const filename of [
        `.env.${stage}`,
        ".env.local",
        `.env.${stage}.local`,
    ]) {
        try {
            Object.assign(values, parse(readFileSync(join(directory, filename))));
        }
        catch (error) {
            if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
                // eslint-disable-next-line preserve-caught-error -- Environment contents must never enter diagnostics.
                throw new Error(`Could not load environment configuration: ${filename}`);
            }
        }
    }
    for (const key of keys) {
        if (target[key] === undefined && values[key] !== undefined) {
            target[key] = values[key];
        }
    }
}
