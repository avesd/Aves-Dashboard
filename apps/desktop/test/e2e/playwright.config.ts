/**
 * @author Avesd
 * @package Desktop
 * @namespace Test_E2e
 * @description Run isolated native Electron smoke tests serially
 */

import { defineConfig } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

export default defineConfig({
    testDir: import.meta.dirname,
    testMatch: "**/*.spec.ts",
    outputDir: join(tmpdir(), "avesd-e2e-results", String(process.pid)),
    workers: 1,
    retries: 0,
    timeout: 30_000,
    reporter: "list",
});
