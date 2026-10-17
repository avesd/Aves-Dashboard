/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_E2e
 * @description Isolate Electron paths before loading the production entry point
 */

import { app } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const directory = process.env.AVESD_E2E_DIRECTORY;
if (!directory) {
    throw new Error("An isolated E2E directory is required.");
}
for (const name of [
    "home",
    "userData",
    "sessionData",
    "logs",
    "env",
]) {
    const path = join(directory, name);
    mkdirSync(path, { recursive: true });
    if (name !== "env") {
        app.setPath(name, path);
    }
}
process.env.HOME = join(directory, "home");
process.env.USERPROFILE = join(directory, "home");
process.env.AVESD_ENV_DIR = join(directory, "env");

await import("../../out/main/index.js");
